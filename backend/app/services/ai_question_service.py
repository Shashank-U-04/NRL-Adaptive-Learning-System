"""
AI question generation with cache-first DeepSeek integration.

The session flow should use local datasets first. This service is only called
when a requested topic/difficulty has no dataset question available.
"""

import json
import logging
import os
import urllib.error
import urllib.request

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.models.models import Question, Topic

logger = logging.getLogger(__name__)

DEEPSEEK_API_URL = os.getenv("DEEPSEEK_API_URL", "https://api.deepseek.com/chat/completions")
DEEPSEEK_API_KEY = os.getenv("DEEPSEEK_API_KEY")
DEEPSEEK_MODEL = os.getenv("DEEPSEEK_MODEL", "deepseek-chat")


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
        "question": raw.get("question") or f"What is a key {difficulty} security control for {_topic_title(topic)}?",
        "options": options,
        "correct_answer": correct_answer,
        "explanation": raw.get("explanation") or "The correct choice follows secure design principles for this topic.",
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
            "explanation": "Least privilege, validation, and monitoring are broadly useful controls across security domains.",
        },
        topic,
        difficulty,
    )


def generate_question(topic: str, difficulty: str) -> dict:
    """
    Generate one multiple-choice question.

    Uses DeepSeek only when `DEEPSEEK_API_KEY` is configured. Otherwise returns
    a deterministic local placeholder so the app remains usable offline.
    """
    if not DEEPSEEK_API_KEY:
        logger.warning("DEEPSEEK_API_KEY not configured; using local AI-question placeholder.")
        return _placeholder_question(topic, difficulty)

    prompt = (
        "Generate exactly one cyber security multiple-choice question as JSON. "
        "Use keys: topic, difficulty, type, question, options, correct_answer, explanation. "
        "Options must be an object with A, B, C, D. correct_answer must be A, B, C, or D. "
        f"Topic bundle: {topic}. Difficulty: {difficulty}."
    )
    payload = {
        "model": DEEPSEEK_MODEL,
        "messages": [
            {"role": "system", "content": "You generate concise, technically accurate cybersecurity quiz questions."},
            {"role": "user", "content": prompt},
        ],
        "temperature": 0.5,
        "response_format": {"type": "json_object"},
    }
    request = urllib.request.Request(
        DEEPSEEK_API_URL,
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {DEEPSEEK_API_KEY}",
            "Content-Type": "application/json",
        },
        method="POST",
    )

    try:
        with urllib.request.urlopen(request, timeout=20) as response:
            data = json.loads(response.read().decode("utf-8"))
        content = data["choices"][0]["message"]["content"]
        return _normalize_question(json.loads(content), topic, difficulty)
    except (KeyError, json.JSONDecodeError, urllib.error.URLError, TimeoutError) as exc:
        logger.error("DeepSeek question generation failed: %s", exc)
        return _placeholder_question(topic, difficulty)


async def get_or_create_ai_question(
    db: AsyncSession,
    topic_slug: str,
    difficulty: str,
) -> Question:
    """Return a cached AI-generated question, generating and storing one if needed."""
    topic_title = _topic_title(topic_slug)
    topic_result = await db.execute(select(Topic).where(Topic.name == topic_title))
    topic = topic_result.scalar_one_or_none()
    if not topic:
        topic = Topic(
            name=topic_title,
            description=f"AI-generated cybersecurity bundle: {topic_title}",
            is_active=True,
        )
        db.add(topic)
        await db.flush()

    cached_result = await db.execute(
        select(Question).where(
            Question.topic_id == topic.id,
            Question.difficulty == difficulty,
            Question.source == "ai",
            Question.is_active == True,
        )
    )
    cached = cached_result.scalars().all()
    if cached:
        import random

        return random.choice(cached)

    generated = generate_question(topic_slug, difficulty)
    question = Question(
        topic_id=topic.id,
        difficulty=difficulty,
        text=generated["question"],
        options=generated["options"],
        correct_answer=generated["correct_answer"],
        explanation=generated["explanation"],
        hint=f"Focus on the safest control for {topic_title}.",
        source="ai",
        is_active=True,
    )
    db.add(question)
    await db.flush()
    return question
