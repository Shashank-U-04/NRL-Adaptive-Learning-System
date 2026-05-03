"""
NRL Adaptive Learning System — AI Module Generation Service

Full production flow:
  1. Idempotency check (DB)
  2. Redis lock (30s TTL) — prevents concurrent duplicate generation
  3. Idempotency double-check inside lock
  4. AI generation via OpenAI + Instructor (Pydantic strict schema)
  5. Retry with exponential backoff (3 attempts)
  6. XSS / HTML sanitization before storage
  7. DB persistence  (is_ai_generated flag)
  8. Lock release (always, even on failure)
  9. Fallback chain: DB partial → static template
"""

import asyncio
import logging
import re
from typing import Any

import redis.asyncio as aioredis
from openai import AsyncOpenAI
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

try:
    import instructor
    INSTRUCTOR_AVAILABLE = True
except ImportError:
    INSTRUCTOR_AVAILABLE = False

from backend.app.core.config import OPENAI_API_KEY, OPENAI_MODEL, OPENAI_BASE_URL, REDIS_URL
from backend.app.models.models import LearningModule, Topic

logger = logging.getLogger("nrl.ai_generation")

# ── Redis client ──────────────────────────────────────────
redis_client = aioredis.from_url(REDIS_URL, decode_responses=True)

# ── OpenAI + Instructor client ────────────────────────────
_ai_client = None
if OPENAI_API_KEY and INSTRUCTOR_AVAILABLE:
    _ai_client = instructor.from_openai(
        AsyncOpenAI(
            api_key=OPENAI_API_KEY,
            base_url=OPENAI_BASE_URL
        )
    )

# ── Strict Pydantic Schema ────────────────────────────────

class ContentBlock(BaseModel):
    type: str = Field(
        ...,
        description="'text' | 'mcq_inline' | 'lab' | 'summary'"
    )
    content: str | None = None
    # mcq_inline fields
    id: str | None = None
    question: str | None = None
    options: list[str] | None = None
    correctIndex: int | None = None
    explanation: str | None = None
    # lab fields
    title: str | None = None
    description: str | None = None
    validation: dict[str, str] | None = None
    successMessage: str | None = None


class LearningModuleSchema(BaseModel):
    topic_id: str
    title: str
    difficulty: int = Field(ge=1, le=3)
    estimatedMinutes: int = Field(ge=1, le=60)
    content: list[ContentBlock]


# ── Sanitization ──────────────────────────────────────────

_DANGEROUS_TAGS = re.compile(
    r"<(script|iframe|object|embed|link|style)[^>]*>.*?</\1>|<(script|iframe|object|embed)[^>]*/?>",
    flags=re.IGNORECASE | re.DOTALL,
)


def _sanitize_str(text: str | None) -> str | None:
    if not text:
        return text
    return _DANGEROUS_TAGS.sub("", text).strip()


def _sanitize_module(data: dict) -> dict:
    """Strip XSS vectors from all text fields before DB storage."""
    for block in data.get("content", []):
        for key in ("content", "question", "explanation", "description", "successMessage", "title"):
            if key in block and block[key]:
                block[key] = _sanitize_str(block[key])
    return data


# ── Core generation function ──────────────────────────────

async def generate_learning_module(
    topic_id: str, db: AsyncSession
) -> dict[str, Any] | None:
    """
    Retrieve or generate a learning module.
    Returns the module content dict or None if all fallbacks fail.
    """
    active_stmt = select(LearningModule).where(
        LearningModule.topic_id == topic_id,
        LearningModule.is_active == True,  # noqa: E712
    )

    # 1. Pre-lock idempotency check
    existing = (await db.execute(active_stmt)).scalar_one_or_none()
    if existing:
        return existing.content

    # 2. Acquire Redis lock
    lock_key = f"lock:gen_module:{topic_id}"
    acquired = await redis_client.set(lock_key, "1", nx=True, ex=30)

    if not acquired:
        # Another process is generating — poll DB for up to 30 s
        for _ in range(15):
            await asyncio.sleep(2)
            existing = (await db.execute(active_stmt)).scalar_one_or_none()
            if existing:
                return existing.content
        logger.warning(f"Lock timeout for topic {topic_id} — returning fallback.")
        return _static_fallback(topic_id)

    try:
        # 3. Double-check inside lock (prevent race condition)
        existing = (await db.execute(active_stmt)).scalar_one_or_none()
        if existing:
            return existing.content

        # 4. AI generation with retry
        module_schema: LearningModuleSchema | None = None
        if _ai_client:
            for attempt in range(3):
                try:
                    logger.info(f"AI generation attempt {attempt + 1} for topic={topic_id}")
                    module_schema = await _ai_client.chat.completions.create(
                        model=OPENAI_MODEL,
                        response_model=LearningModuleSchema,
                        messages=[
                            {
                                "role": "system",
                                "content": (
                                    "You are a senior cybersecurity instructor. "
                                    "Output ONLY valid JSON matching the provided schema exactly. "
                                    "No markdown, no extra text."
                                ),
                            },
                            {
                                "role": "user",
                                "content": (
                                    f"Generate a structured learning module for cybersecurity topic: '{topic_id}'. "
                                    "Include: an introduction text block, at least 2 inline MCQs with explanations, "
                                    "1 practical lab simulation (string-based validation only, no code execution), "
                                    "and a summary block."
                                ),
                            },
                        ],
                    )
                    break
                except Exception as exc:
                    logger.error(f"AI attempt {attempt + 1} failed: {exc}")
                    if attempt < 2:
                        await asyncio.sleep(2 ** attempt)   # 1 s, 2 s

        # 5. Build dict from schema or fallback
        if module_schema:
            content = _sanitize_module(module_schema.model_dump())
        else:
            logger.warning(f"AI generation failed for {topic_id} — using static fallback.")
            content = _static_fallback(topic_id)

        # 6. Ensure topic row exists
        topic_row = (await db.execute(select(Topic).where(Topic.id == topic_id))).scalar_one_or_none()
        if not topic_row:
            topic_row = Topic(
                id=topic_id,
                title=content.get("title", topic_id.replace("-", " ").title()),
            )
            db.add(topic_row)
            await db.flush()

        # 7. Persist
        module = LearningModule(
            topic_id=topic_id,
            content=content,
            is_ai_generated=bool(module_schema),
        )
        db.add(module)
        await db.commit()
        logger.info(f"Module stored for topic={topic_id} (ai={bool(module_schema)}).")
        return content

    except Exception as exc:
        logger.error(f"Unexpected error generating module {topic_id}: {exc}")
        await db.rollback()
        return _static_fallback(topic_id)

    finally:
        # 8. Always release lock
        await redis_client.delete(lock_key)


def _static_fallback(topic_id: str) -> dict:
    """Minimal safe module template returned when all AI attempts fail."""
    friendly = topic_id.replace("-", " ").title()
    return {
        "topic_id": topic_id,
        "title": f"Introduction to {friendly}",
        "difficulty": 1,
        "estimatedMinutes": 5,
        "content": [
            {
                "type": "text",
                "content": (
                    f"Welcome to the {friendly} module. "
                    "This content will be updated shortly. "
                    "Please check back or contact your instructor."
                ),
            },
            {
                "type": "summary",
                "content": f"Module for {friendly} is temporarily unavailable.",
            },
        ],
    }
