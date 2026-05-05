"""
AI quiz-question generation with cache-first reuse.

The session flow uses local datasets first. This service is only invoked when a
requested topic/difficulty has no dataset question available. Generated
questions are stored in the `questions` table with source='ai' and reused.

Provider chain (auto-fallback): Ollama → OpenAI/OpenRouter → Together → static.
"""

from __future__ import annotations

import logging
import random

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.core.metrics import ai_calls_total
from backend.app.models.models import Question, Topic
from backend.app.services.ai_provider import AIProviderError, get_ai_provider

logger = logging.getLogger("nrl.ai_question")


def _topic_title(topic: str) -> str:
    return topic.replace("-", " ").replace("_", " ").title()


def _normalize_question(raw: dict, topic: str, difficulty: str) -> dict:
    options = raw.get("options") or {}
    if isinstance(options, list):
        options = {chr(65 + i): value for i, value in enumerate(options[:4])}

    if not isinstance(options, dict) or len(options) < 4:
        options = {
            "A": "Validate input and use secure defaults",
            "B": "Disable logging and monitoring",
            "C": "Trust all authenticated users",
            "D": "Store secrets in client-side code",
        }

    correct_answer = str(raw.get("correct_answer", "A")).strip().upper()
    if correct_answer not in options:
        correct_answer = "A"

    return {
        "topic": raw.get("topic") or _topic_title(topic),
        "difficulty": difficulty,
        "type": raw.get("type") or "multiple_choice",
        "question": raw.get("question")
        or f"What is a key {difficulty} security control for {_topic_title(topic)}?",
        "options": options,
        "correct_answer": correct_answer,
        "explanation": raw.get("explanation")
        or "The correct choice follows secure design principles for this topic.",
    }


def _placeholder_question(topic: str, difficulty: str) -> dict:
    title = _topic_title(topic)
    return _normalize_question(
        {
            "topic": title,
            "question": f"In {title}, which practice best reduces real-world security risk?",
            "options": {
                "A": "Apply least privilege, validate inputs, and monitor important events",
                "B": "Rely only on hidden UI controls",
                "C": "Share administrator credentials for faster response",
                "D": "Disable security updates during development",
            },
            "correct_answer": "A",
            "explanation": (
                "Least privilege, validation, and monitoring are broadly useful controls "
                "across security domains."
            ),
        },
        topic,
        difficulty,
    )


async def generate_question(topic: str, difficulty: str) -> dict:
    """Generate one MCQ via the AI provider chain. Returns a placeholder on failure."""
    system = (
        "You generate concise, technically accurate cybersecurity quiz questions. "
        "Respond ONLY with valid JSON."
    )
    user = (
        "Generate exactly one cybersecurity multiple-choice question.\n"
        "Return JSON with keys: topic, difficulty, type, question, options, correct_answer, explanation.\n"
        "options must be an object with keys A, B, C, D.\n"
        "correct_answer must be one of A, B, C, D.\n"
        f"Topic: {topic}. Difficulty: {difficulty}."
    )
    try:
        provider = await get_ai_provider()
        raw = await provider.generate_json(system=system, user=user, temperature=0.5, max_tokens=600)
        ai_calls_total.labels(provider=provider.preferred, status="generated").inc()
        return _normalize_question(raw, topic, difficulty)
    except (AIProviderError, ValueError, KeyError, OSError) as exc:
        logger.warning(f"AI question generation failed for {topic}/{difficulty}: {exc}")
        ai_calls_total.labels(provider="fallback", status="static").inc()
        return _placeholder_question(topic, difficulty)


async def get_or_create_ai_question(
    db: AsyncSession,
    topic_slug: str,
    difficulty: str,
) -> Question:
    """Return a cached AI-generated question, generating one if needed."""
    topic_id = topic_slug.lower().strip()
    topic_row = (
        await db.execute(select(Topic).where(Topic.id == topic_id))
    ).scalar_one_or_none()

    if not topic_row:
        topic_row = Topic(
            id=topic_id,
            title=_topic_title(topic_slug),
            description=f"AI-generated cybersecurity bundle: {_topic_title(topic_slug)}",
            is_active=True,
        )
        db.add(topic_row)
        await db.flush()

    cached_result = await db.execute(
        select(Question).where(
            Question.topic_id == topic_row.id,
            Question.difficulty == difficulty,
            Question.source == "ai",
        )
    )
    cached = cached_result.scalars().all()
    if cached:
        ai_calls_total.labels(provider="cache", status="hit").inc()
        return random.choice(cached)

    generated = await generate_question(topic_slug, difficulty)
    question = Question(
        topic_id=topic_row.id,
        difficulty=difficulty,
        text=generated["question"],
        options=generated["options"],
        correct_answer=generated["correct_answer"],
        explanation=generated["explanation"],
        hint=f"Focus on the safest control for {_topic_title(topic_slug)}.",
        source="ai",
    )
    db.add(question)
    await db.flush()
    return question
