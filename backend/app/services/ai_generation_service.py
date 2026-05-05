"""
NRL Adaptive Learning System — AI Module Generation Service

Flow:
  1. Idempotency check (DB)  — return cached active module if present
  2. In-process per-topic asyncio.Lock — prevents concurrent duplicate work
  3. Re-check inside lock
  4. Call AIProvider (Ollama → OpenAI → Together) with strict JSON schema
  5. Sanitize content (strip dangerous HTML)
  6. Persist to learning_modules
  7. Always release lock; never block other topics

No Redis required. The AI provider chain is configurable; if every provider is
unavailable, a deterministic static fallback module is returned so the learning
flow never breaks.
"""

from __future__ import annotations

import asyncio
import logging
import re
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import CACHE_EXPIRY_DAYS
from app.core.metrics import ai_calls_total
from app.models.models import LearningModule, Topic
from app.services.ai_provider import AIProviderError, get_ai_provider

logger = logging.getLogger("nrl.ai_generation")

# ── Per-topic locks (in-process; no external broker needed) ────────────
_topic_locks: dict[str, asyncio.Lock] = defaultdict(asyncio.Lock)


def _is_fresh(module: LearningModule) -> bool:
    """A module is fresh if CACHE_EXPIRY_DAYS<=0 (never expire) or it was
    created within the expiry window. Stale modules trigger regeneration."""
    if CACHE_EXPIRY_DAYS <= 0:
        return True
    created = module.created_at
    if created is None:
        return True
    if created.tzinfo is None:
        created = created.replace(tzinfo=timezone.utc)
    age = datetime.now(timezone.utc) - created
    return age < timedelta(days=CACHE_EXPIRY_DAYS)


# ── Sanitization ─────────────────────────────────────────────
_DANGEROUS_TAGS = re.compile(
    r"<(script|iframe|object|embed|link|style)[^>]*>.*?</\1>|"
    r"<(script|iframe|object|embed)[^>]*/?>",
    flags=re.IGNORECASE | re.DOTALL,
)


def _sanitize_str(text: str | None) -> str | None:
    if not text:
        return text
    return _DANGEROUS_TAGS.sub("", text).strip()


def _sanitize_module(data: dict) -> dict:
    """Strip XSS vectors from text fields before storage."""
    for block in data.get("content", []) or []:
        for key in (
            "content",
            "question",
            "explanation",
            "description",
            "successMessage",
            "title",
        ):
            if isinstance(block.get(key), str):
                block[key] = _sanitize_str(block[key])
    return data


# ── Validation helpers ───────────────────────────────────────
def _normalize_module(raw: dict, topic_id: str) -> dict:
    """Normalize an AI response into the expected schema."""
    title = raw.get("title") or topic_id.replace("-", " ").title()
    difficulty = int(raw.get("difficulty") or 1)
    estimated = int(raw.get("estimatedMinutes") or raw.get("estimated_minutes") or 10)
    content = raw.get("content") or []

    if not isinstance(content, list):
        content = []

    cleaned_blocks: list[dict] = []
    for block in content:
        if not isinstance(block, dict):
            continue
        block_type = (block.get("type") or "").lower()
        if block_type not in {"text", "mcq_inline", "lab", "summary", "scenario", "diagram"}:
            continue
        cleaned_blocks.append(block)

    if not cleaned_blocks:
        cleaned_blocks = _static_blocks(topic_id)

    return {
        "topic_id": topic_id,
        "title": title,
        "difficulty": max(1, min(3, difficulty)),
        "estimatedMinutes": max(1, min(60, estimated)),
        "content": cleaned_blocks,
    }


# ── Core generation ─────────────────────────────────────────
async def generate_learning_module(
    topic_id: str, db: AsyncSession
) -> dict[str, Any]:
    """
    Retrieve existing module or generate a new one.
    Always returns a usable module dict (static fallback if AI unavailable).
    """
    active_stmt = select(LearningModule).where(
        LearningModule.topic_id == topic_id,
        LearningModule.is_active == True,  # noqa: E712
    )

    # 1. Pre-lock idempotency check
    existing = (await db.execute(active_stmt)).scalar_one_or_none()
    if existing and _is_fresh(existing):
        ai_calls_total.labels(provider="cache", status="hit").inc()
        return existing.content

    lock = _topic_locks[topic_id]

    async with lock:
        # 2. Re-check inside lock
        existing = (await db.execute(active_stmt)).scalar_one_or_none()
        if existing and _is_fresh(existing):
            ai_calls_total.labels(provider="cache", status="hit").inc()
            return existing.content
        if existing:
            # Stale: deactivate so a fresh module can take its place.
            existing.is_active = False
            await db.flush()
            ai_calls_total.labels(provider="cache", status="stale").inc()
            logger.info(f"Cached module for topic={topic_id} is stale; regenerating.")

        # 3. Call AI
        content: dict[str, Any]
        ai_used = False
        try:
            provider = await get_ai_provider()
            system = (
                "You are a senior cybersecurity instructor. "
                "Respond ONLY with valid JSON. No markdown, no commentary."
            )
            user = (
                f"Generate a structured learning module for cybersecurity topic: '{topic_id}'.\n"
                "Return JSON with this exact shape:\n"
                "{\n"
                '  "topic_id": "<slug>",\n'
                '  "title": "...",\n'
                '  "difficulty": 1,\n'
                '  "estimatedMinutes": 10,\n'
                '  "content": [\n'
                '    {"type":"text","content":"intro paragraph..."},\n'
                '    {"type":"mcq_inline","id":"mcq1","question":"...","options":["A","B","C","D"],"correctIndex":0,"explanation":"..."},\n'
                '    {"type":"mcq_inline","id":"mcq2","question":"...","options":["A","B","C","D"],"correctIndex":1,"explanation":"..."},\n'
                '    {"type":"lab","title":"...","description":"...","validation":{"rule_type":"contains","pattern":"..."},"successMessage":"..."},\n'
                '    {"type":"summary","content":"key takeaways..."}\n'
                "  ]\n"
                "}"
            )
            raw = await provider.generate_json(system=system, user=user, temperature=0.5, max_tokens=2000)
            content = _normalize_module(raw, topic_id)
            ai_used = True
            ai_calls_total.labels(provider=provider.preferred, status="generated").inc()
            logger.info(f"AI module generated for topic={topic_id}")
        except (AIProviderError, ValueError, KeyError, OSError) as exc:
            logger.warning(f"AI generation failed for {topic_id}: {exc}. Using static fallback.")
            ai_calls_total.labels(provider="fallback", status="static").inc()
            content = _static_fallback(topic_id)

        content = _sanitize_module(content)

        # 4. Ensure topic row exists
        topic_row = (
            await db.execute(select(Topic).where(Topic.id == topic_id))
        ).scalar_one_or_none()
        if not topic_row:
            topic_row = Topic(
                id=topic_id,
                title=content.get("title", topic_id.replace("-", " ").title()),
                description=f"Auto-created from learning module flow",
                is_active=True,
            )
            db.add(topic_row)
            await db.flush()

        # 5. Persist module (avoid race: re-check then insert)
        existing = (await db.execute(active_stmt)).scalar_one_or_none()
        if existing:
            return existing.content

        module = LearningModule(
            topic_id=topic_id,
            content=content,
            is_ai_generated=ai_used,
        )
        db.add(module)
        await db.commit()
        return content


# ── Static fallbacks ─────────────────────────────────────────
def _static_blocks(topic_id: str) -> list[dict]:
    friendly = topic_id.replace("-", " ").title()
    return [
        {
            "type": "text",
            "content": (
                f"Welcome to the {friendly} module. "
                f"This topic covers core security concepts and practical defenses you can apply today."
            ),
        },
        {
            "type": "mcq_inline",
            "id": "mcq_1",
            "question": f"Which is the most important first step when securing {friendly}?",
            "options": [
                "Apply least privilege and validate all inputs",
                "Disable logging to improve performance",
                "Trust internal network traffic by default",
                "Embed credentials in client-side code",
            ],
            "correctIndex": 0,
            "explanation": "Least privilege and input validation are foundational across all security domains.",
        },
        {
            "type": "lab",
            "title": "Spot the issue",
            "description": "Submit the keyword 'sanitize' to acknowledge that user input must always be sanitized.",
            "validation": {"rule_type": "contains", "pattern": "sanitize"},
            "successMessage": "Correct — never trust user input without validation.",
        },
        {
            "type": "summary",
            "content": (
                f"You learned the basics of {friendly}: validate inputs, apply least privilege, "
                "and monitor for anomalies. Practice quizzes will reinforce these patterns."
            ),
        },
    ]


def _static_fallback(topic_id: str) -> dict:
    """Safe module returned when AI generation fails."""
    friendly = topic_id.replace("-", " ").title()
    return {
        "topic_id": topic_id,
        "title": f"Introduction to {friendly}",
        "difficulty": 1,
        "estimatedMinutes": 10,
        "content": _static_blocks(topic_id),
    }
