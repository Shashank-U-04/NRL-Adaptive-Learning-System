"""
NRL Adaptive Learning System — Session Service

Full adaptive quiz lifecycle:
  start_session  → initialise RL state, fetch first question
  process_answer → evaluate, compute reward, update state, get next action
  end_session    → finalise, update learner metrics + profile

Uses the rich 7-feature state vector aligned with the production RL architecture.
"""

import json
import logging
import random
import re
from datetime import datetime, timezone
from pathlib import Path

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.models import (
    User, Session, SessionEvent, Question, QuestionAttempt,
    Topic, LearnerMetric, Profile,
)
from app.adaptive.engine import get_adaptive_engine, AdaptiveEngine
from app.adaptive.rules import ACTIONS
from app.core.config import ROOT_DIR, SESSION_TTL_SECONDS
from app.schemas.schemas import (
    QuestionPayload, StartSessionResponse,
    AnswerResponse, SessionSummary, SessionHistoryItem,
)

logger = logging.getLogger("nrl.session")

# ── Question dataset config ───────────────────────────────
DIFFICULTY_MAP = {
    "Present_Easy_Question":   "easy",
    "Present_Medium_Question": "medium",
    "Present_Hard_Question":   "hard",
}
LEVEL_FILES = {
    "easy":   "level1.json",
    "medium": "level2.json",
    "hard":   "level3.json",
}
CYBER_DATA_ROOT = ROOT_DIR / "backend" / "app" / "data" / "cybersecurity"
DEFAULT_DATASET  = "web-security"


def _topic_has_json_dataset(topic_slug: str) -> bool:
    """Return True if at least one level{1,2,3}.json file exists for the topic."""
    topic_dir = CYBER_DATA_ROOT / topic_slug
    if not topic_dir.is_dir():
        return False
    return any((topic_dir / fname).is_file() for fname in LEVEL_FILES.values())


_SLUG_COLLAPSE_RE = re.compile(r"-+")


def _normalize_topic(topic: str | None) -> str:
    """Canonicalize a topic identifier into a filesystem-safe slug.

    Examples:
        "Web Security"  -> "web-security"
        "web_security"  -> "web-security"
        "  Web  "       -> "web"
        None            -> DEFAULT_DATASET
    """
    if not topic:
        return DEFAULT_DATASET
    slug = topic.strip().lower()
    slug = re.sub(r"[\s_]+", "-", slug)
    slug = _SLUG_COLLAPSE_RE.sub("-", slug).strip("-")
    return slug or DEFAULT_DATASET


def _load_random_question(topic: str, difficulty: str) -> dict | None:
    """Load a random question from JSON dataset files."""
    diff = difficulty.lower() if difficulty in LEVEL_FILES else "medium"
    path = CYBER_DATA_ROOT / topic / LEVEL_FILES[diff]
    try:
        with path.open("r", encoding="utf-8") as f:
            questions = json.load(f)
    except FileNotFoundError:
        return None
    if not questions:
        return None
    q = random.choice(questions).copy()
    q["source"] = "dataset"
    return q


def _find_question_by_id(question_id: str, topic: str | None = None) -> dict | None:
    """Scan a topic's level files for a question by ID.

    Behaviour:
      * When ``topic`` is provided, search **only** that topic. No cross-topic
        fallback — a non-web topic must never silently resolve a web-security
        question (which previously let ``correct_answer`` default to the
        learner's input and counted every answer as "correct").
      * When ``topic`` is ``None``, search only ``DEFAULT_DATASET`` for legacy
        callers that don't yet pass a topic.
    """
    topic_slug = topic if topic else DEFAULT_DATASET
    for level_file in LEVEL_FILES.values():
        path = CYBER_DATA_ROOT / topic_slug / level_file
        if not path.exists():
            continue
        with path.open("r", encoding="utf-8") as f:
            for q in json.load(f):
                if q.get("id") == question_id:
                    return q.copy()
    return None


# ── In-process session state cache ───────────────────────
# Keyed by session_id; holds the live RL state dict.
# In production swap this for Redis via aioredis.
_SESSION_CACHE: dict[str, dict] = {}


def _cache_get(session_id: str) -> dict | None:
    return _SESSION_CACHE.get(session_id)


def _cache_set(session_id: str, state: dict) -> None:
    _SESSION_CACHE[session_id] = state


def _cache_delete(session_id: str) -> None:
    _SESSION_CACHE.pop(session_id, None)


class SessionService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.rl: AdaptiveEngine = get_adaptive_engine()

    # ── Public methods ────────────────────────────────────

    async def _validate_topic(self, topic_id: str) -> str:
        """Validate that ``topic_id`` is a *content-backed* quiz topic.

        Acceptance rules (any one):
          1. A JSON dataset directory exists at
             ``backend/app/data/cybersecurity/<slug>/`` with at least one
             ``levelN.json`` file.
          2. At least one ``Question`` row exists with this ``topic_id``.

        Having a matching ``Topic`` row alone is NOT sufficient — topics
        can exist purely for learning/progress without any questions, and
        a quiz session against an empty topic would never serve a question.

        For JSON-backed topics we lazily register the ``Topic`` row so the
        session's ``topic_id`` FK resolves. Arbitrary slugs (typos, junk)
        are rejected with HTTP 400 and create no DB rows.
        """
        json_backed = _topic_has_json_dataset(topic_id)

        has_db_questions = False
        if not json_backed:
            count_result = await self.db.execute(
                select(Question.id).where(Question.topic_id == topic_id).limit(1)
            )
            has_db_questions = count_result.scalar_one_or_none() is not None

        if not json_backed and not has_db_questions:
            logger.warning(
                "Rejected topic with no quiz content: %s (json=False, db_questions=False)",
                topic_id,
            )
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    f"Topic '{topic_id}' has no quiz content available. "
                    "Choose a seeded topic with questions or one with a local JSON dataset."
                ),
            )

        result = await self.db.execute(
            select(Topic).where(Topic.id == topic_id)
        )
        topic = result.scalar_one_or_none()
        if topic is None:
            topic = Topic(
                id=topic_id,
                title=topic_id.replace("-", " ").title(),
                description=f"Auto-registered for content-backed topic '{topic_id}'.",
                is_active=True,
            )
            self.db.add(topic)
            await self.db.flush()
            logger.info("Registered Topic row for content-backed topic: %s", topic_id)
        elif not topic.is_active:
            topic.is_active = True
            await self.db.flush()
        return topic.id

    async def start_session(
        self, user: User, topic: str | None = None
    ) -> StartSessionResponse:
        topic_slug = _normalize_topic(topic)

        # Validate the topic — rejects unknown/junk slugs with HTTP 400.
        await self._validate_topic(topic_slug)

        state = self.rl.initial_state()

        # Create DB session row
        session = Session(
            user_id=user.id,
            topic_id=topic_slug,
            status="active",
            state_vector=state,
        )
        self.db.add(session)
        await self.db.flush()

        # First RL recommendation
        action_name, confidence, explanation = self.rl.recommend_action(state)
        difficulty = DIFFICULTY_MAP.get(action_name, "medium")

        # Cache live state. Underscored keys are cache-only metadata and are
        # stripped out before the state vector is encoded for the DQN.
        _cache_set(
            session.id,
            {**state, "_topic": topic_slug, "_consecutive_correct": 0},
        )

        question = await self._fetch_question(difficulty, topic_slug)

        # Log RL step
        event = SessionEvent(
            session_id=session.id,
            step_number=0,
            state_before=state,
            action_taken=action_name,
            reward=0.0,
            state_after=state,
            explanation=explanation,
        )
        self.db.add(event)
        # get_db() owns the transaction boundary; flush sends SQL now so
        # the session row's generated id is visible to the caller without
        # committing partially-completed state.
        await self.db.flush()

        return StartSessionResponse(
            session_id=session.id,
            initial_state=state,
            first_action=action_name,
            explanation=explanation,
            confidence=confidence,
            question=question,
        )

    async def process_answer(
        self,
        user: User,
        session_id: str,
        question_id: str,
        selected_answer: str,
        time_taken: int,
    ) -> AnswerResponse:
        session = await self._get_active_session(session_id, user.id)

        # Authoritative topic is whatever was persisted on the session row at
        # /start time — NOT a cached metadata field that can fall back to
        # web-security on cache miss/restart/multi-worker.
        topic_slug = session.topic_id or DEFAULT_DATASET

        cached = _cache_get(session_id)
        if cached is not None:
            # Copy so we don't mutate the live cache entry mid-handler.
            state = {k: v for k, v in cached.items() if not k.startswith("_")}
            prev_consecutive_correct = int(
                cached.get("_consecutive_correct", session.consecutive_correct or 0)
            )
        else:
            # Cache miss — reconstruct the RL state from the DB snapshot.
            # ``Session.consecutive_correct`` is persisted on every answer,
            # so we no longer lose the streak across worker restarts.
            persisted = (
                session.state_vector
                if isinstance(session.state_vector, dict)
                else None
            )
            state = {
                k: v for k, v in (persisted or self.rl.initial_state()).items()
                if not k.startswith("_")
            }
            prev_consecutive_correct = int(session.consecutive_correct or 0)
            logger.warning(
                "Session cache miss for %s — reconstructing state from DB "
                "(topic=%s, streak=%d)",
                session_id, topic_slug, prev_consecutive_correct,
            )

        # ── Resolve question (must match the session's topic) ────────────
        # We refuse to grade a question from a different topic against this
        # session. Previously a DB-only lookup by id could pull a question
        # from any topic, and the missing-question branch silently graded
        # ``selected_answer`` as "correct" (correct_answer defaulted to the
        # user's input). Both holes are closed here.
        json_q = _find_question_by_id(question_id, topic_slug)
        db_q: Question | None = None
        if json_q is None:
            db_result = await self.db.execute(
                select(Question).where(
                    Question.id == question_id,
                    Question.topic_id == topic_slug,
                )
            )
            db_q = db_result.scalar_one_or_none()

        if json_q is None and db_q is None:
            logger.warning(
                "Rejected answer: question %s not found for topic %s (session=%s)",
                question_id, topic_slug, session_id,
            )
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=(
                    f"Question '{question_id}' is not part of this session's topic "
                    f"'{topic_slug}'. The answer was not graded."
                ),
            )

        if json_q:
            correct_answer = json_q.get("correct_answer", "")
            q_explanation = json_q.get("explanation")
            answered_difficulty = json_q.get("difficulty", "medium").lower()
            is_correct = (
                selected_answer.strip().upper() == correct_answer.strip().upper()
            )
        else:
            assert db_q is not None  # narrowed by branch above
            correct_answer = db_q.correct_answer
            q_explanation = db_q.explanation
            answered_difficulty = db_q.difficulty
            is_correct = (
                selected_answer.strip().lower() == correct_answer.strip().lower()
            )
            db_q.times_served += 1
            if is_correct:
                db_q.times_correct += 1

        # ── Update rich state vector ──────────────────────
        prev_accuracy = state.get("quiz_accuracy", 0.5)
        new_state = self._update_state(state, is_correct, time_taken)
        consecutive_correct = prev_consecutive_correct + 1 if is_correct else 0

        # Determine if this is an improvement for reward calc
        new_acc = new_state["quiz_accuracy"]
        is_improvement = new_acc > prev_accuracy
        is_repeated_mistake = (not is_correct) and state.get("quiz_accuracy", 0.5) < 0.4

        reward = AdaptiveEngine.calculate_reward(
            is_correct=is_correct,
            is_improvement=is_improvement,
            is_repeated_mistake=is_repeated_mistake,
        )

        # ── Persist attempt ───────────────────────────────
        # For JSON-dataset questions we store the original id on
        # ``source_question_id`` so per-question analytics is *possible*
        # later. The current analytics endpoints don't aggregate by it
        # yet — see app/models/models.py for the field's contract.
        attempt = QuestionAttempt(
            session_id=session_id,
            question_id=question_id if not json_q else None,
            source_question_id=question_id if json_q else None,
            user_id=user.id,
            selected_answer=selected_answer,
            is_correct=is_correct,
            time_taken_seconds=time_taken,
            difficulty=answered_difficulty,
        )
        self.db.add(attempt)

        # ── Update session counters ───────────────────────
        session.total_steps += 1
        session.questions_answered += 1
        session.total_reward += reward
        session.state_vector = new_state
        session.last_reward = reward
        # Persist the streak alongside other counters so multi-worker reads
        # see the latest value even when the in-process cache is cold.
        session.consecutive_correct = consecutive_correct
        if is_correct:
            session.correct_answers += 1

        # ── Update profile counters (live) ────────────────
        await self._update_profile_counters(user.id, is_correct)

        # ── Update learner metrics ────────────────────────
        await self._update_topic_metric(user.id, topic_slug, is_correct, time_taken)

        # ── Next RL recommendation ────────────────────────
        action_name, confidence, explanation = self.rl.recommend_action(new_state)
        session_done = action_name == "End_Session" or session.total_steps >= 30

        next_question: QuestionPayload | None = None
        if not session_done:
            next_diff = DIFFICULTY_MAP.get(action_name, "medium")
            next_question = await self._fetch_question(next_diff, topic_slug)

        # Log RL step
        event = SessionEvent(
            session_id=session_id,
            step_number=session.total_steps,
            state_before=state,
            action_taken=action_name,
            reward=reward,
            state_after=new_state,
            explanation=explanation,
        )
        self.db.add(event)

        # Update cache (preserves cache-only metadata; not written to DB)
        _cache_set(
            session_id,
            {
                **new_state,
                "_topic": topic_slug,
                "_consecutive_correct": consecutive_correct,
            },
        )

        if session_done:
            await self._finalize_session(session, new_state, user)

        # Let get_db() commit the whole answer atomically.
        await self.db.flush()

        return AnswerResponse(
            is_correct=is_correct,
            correct_answer=correct_answer,
            explanation=q_explanation,
            reward=reward,
            next_action=action_name,
            action_explanation=explanation,
            confidence=confidence,
            next_question=next_question,
            session_done=session_done,
            updated_state=new_state,
            streak=consecutive_correct,
        )

    async def end_session(self, user: User, session_id: str) -> SessionSummary:
        result = await self.db.execute(
            select(Session).where(Session.id == session_id, Session.user_id == user.id)
        )
        session = result.scalar_one_or_none()
        if not session:
            raise HTTPException(status_code=404, detail="Session not found.")

        cached = _cache_get(session_id)
        if cached is not None:
            # Strip cache-only metadata before persisting as state_vector.
            state = {k: v for k, v in cached.items() if not k.startswith("_")}
        else:
            persisted = session.state_vector if isinstance(session.state_vector, dict) else None
            state = persisted or self.rl.initial_state()

        if session.status == "active":
            await self._finalize_session(session, state, user)

        _cache_delete(session_id)
        # Commit happens in get_db() once the handler returns successfully.
        await self.db.flush()
        return self._build_summary(session)

    # ── Private helpers ───────────────────────────────────

    async def _get_active_session(self, session_id: str, user_id: str) -> Session:
        result = await self.db.execute(
            select(Session).where(
                Session.id == session_id,
                Session.user_id == user_id,
                Session.status == "active",
            )
        )
        session = result.scalar_one_or_none()
        if not session:
            raise HTTPException(status_code=404, detail="Active session not found.")
        return session

    async def _fetch_question(self, difficulty: str, topic: str) -> QuestionPayload | None:
        """Return the next question for ``topic`` at the requested difficulty.

        Strict topic scoping — never falls back to another topic's questions.
        Order tried:
          1. Local JSON dataset under that topic.
          2. DB ``questions`` row with ``topic_id == topic`` and matching difficulty.
          3. DB ``questions`` row with ``topic_id == topic`` (any difficulty).

        Returns ``None`` only when this topic genuinely has no content at the
        requested difficulty or below. The caller should surface a clean
        empty-session response in that case.
        """
        # 1. Try local JSON dataset (if curated for this topic)
        q = _load_random_question(topic, difficulty)
        if q:
            return QuestionPayload(
                id=q["id"],
                text=q.get("question", ""),
                options=q.get("options", {}),
                difficulty=q.get("difficulty", difficulty),
                topic_name=q.get("topic", topic),
                hint_available="hint" in q,
                source=q.get("source", "dataset"),
            )

        # 2. DB lookup — filter by topic + difficulty
        result = await self.db.execute(
            select(Question)
            .where(
                Question.topic_id == topic,
                Question.difficulty == difficulty,
            )
            .limit(20)
        )
        qs = result.scalars().all()

        # 3. Relax to any difficulty for THIS topic only — never cross topics.
        if not qs:
            result = await self.db.execute(
                select(Question).where(Question.topic_id == topic).limit(20)
            )
            qs = result.scalars().all()

        if qs:
            db_q = random.choice(qs)
            return QuestionPayload(
                id=db_q.id,
                text=db_q.text,
                options=db_q.options,
                difficulty=db_q.difficulty,
                topic_name=db_q.topic_id,
                hint_available=db_q.hint is not None,
                source=db_q.source,
            )

        return None

    def _update_state(self, state: dict, is_correct: bool, time_taken: int) -> dict:
        """Update the rich 7-feature state after each MCQ answer.

        Uses an exponential moving average for accuracy metrics. Quiz sessions
        produce MCQ answers, so we drive both ``quiz_accuracy`` and
        ``mcq_accuracy`` from the same outcome. ``lab_success_rate`` is left
        untouched here — it is updated separately from learning-mode lab
        events so quiz-only sessions don't accidentally inflate or deflate
        the lab signal.
        """
        new = state.copy()
        alpha = 0.2   # EMA smoothing factor
        outcome = 1.0 if is_correct else 0.0

        old_qa = state.get("quiz_accuracy", 0.5)
        new["quiz_accuracy"] = round(old_qa * (1 - alpha) + outcome * alpha, 4)

        # Keep MCQ-specific accuracy in lockstep with the quiz signal during
        # quiz sessions — every answer here IS an MCQ.
        old_ma = state.get("mcq_accuracy", 0.5)
        new["mcq_accuracy"] = round(old_ma * (1 - alpha) + outcome * alpha, 4)

        # Trend
        if new["quiz_accuracy"] > old_qa + 0.02:
            new["recent_trend"] = "improving"
        elif new["quiz_accuracy"] < old_qa - 0.02:
            new["recent_trend"] = "declining"
        else:
            new["recent_trend"] = "stable"

        # Attempts and response time
        new["attempts_count"] = state.get("attempts_count", 0) + 1
        old_art = state.get("avg_response_time", 10.0)
        n = new["attempts_count"]
        new["avg_response_time"] = round(old_art + (time_taken - old_art) / n, 2)

        # Topic confidence: simple running accuracy
        new["topic_confidence"] = new["quiz_accuracy"]

        return new

    async def _update_profile_counters(self, user_id: str, is_correct: bool) -> None:
        """Bump per-user totals for dashboard accuracy."""
        result = await self.db.execute(
            select(Profile).where(Profile.user_id == user_id)
        )
        profile = result.scalar_one_or_none()
        if not profile:
            profile = Profile(user_id=user_id)
            self.db.add(profile)
            await self.db.flush()
        profile.total_questions_answered += 1
        if is_correct:
            profile.total_correct += 1
        profile.last_active = datetime.now(timezone.utc)

    async def _update_topic_metric(
        self, user_id: str, topic_id: str, is_correct: bool, time_taken: int
    ) -> None:
        result = await self.db.execute(
            select(LearnerMetric).where(
                LearnerMetric.user_id == user_id,
                LearnerMetric.topic_id == topic_id,
            )
        )
        metric = result.scalar_one_or_none()
        if not metric:
            metric = LearnerMetric(user_id=user_id, topic_id=topic_id)
            self.db.add(metric)
            await self.db.flush()

        n = metric.questions_attempted
        metric.questions_attempted += 1
        if is_correct:
            metric.questions_correct += 1
        metric.avg_time_seconds = round(
            (metric.avg_time_seconds * n + time_taken) / metric.questions_attempted, 2
        )
        metric.mastery_score = round(
            metric.questions_correct / metric.questions_attempted * 100, 1
        )
        metric.last_practiced = datetime.now(timezone.utc)

    async def _finalize_session(
        self, session: Session, state: dict, user: User
    ) -> None:
        session.status = "completed"
        session.ended_at = datetime.now(timezone.utc)
        session.state_vector = state

        # Update profile
        result = await self.db.execute(
            select(Profile).where(Profile.user_id == user.id)
        )
        profile = result.scalar_one_or_none()
        if profile:
            profile.sessions_completed += 1
            profile.last_active = datetime.now(timezone.utc)
            acc = session.accuracy
            kl = "advanced" if acc >= 80 else "intermediate" if acc >= 50 else "beginner"
            profile.knowledge_level = kl
            profile.total_xp += max(0, int(session.total_reward * 10))
            session_was_productive = session.correct_answers > 0
            if session_was_productive:
                profile.current_streak += 1
                if profile.current_streak > profile.longest_streak:
                    profile.longest_streak = profile.current_streak
            else:
                profile.current_streak = 0

        logger.info(
            f"Session {session.id} completed — "
            f"{session.correct_answers}/{session.questions_answered} correct, "
            f"reward={session.total_reward:.2f}"
        )

    def _build_summary(self, session: Session) -> SessionSummary:
        return SessionSummary(
            session_id=session.id,
            total_questions=session.questions_answered,
            correct_answers=session.correct_answers,
            accuracy=session.accuracy,
            total_reward=session.total_reward,
            duration_seconds=session.duration_seconds or 0,
            hints_used=session.hints_used,
            xp_earned=max(0, int(session.total_reward * 10)),
        )
