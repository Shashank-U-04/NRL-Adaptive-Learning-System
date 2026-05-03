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
from datetime import datetime, timezone
from pathlib import Path

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.models.models import (
    User, Session, SessionEvent, Question, QuestionAttempt,
    Topic, LearnerMetric, Profile,
)
from backend.app.services.rl_service import get_rl_service, RLService, ACTIONS
from backend.app.core.config import ROOT_DIR, SESSION_TTL_SECONDS
from backend.app.schemas.schemas import (
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


def _normalize_topic(topic: str | None) -> str:
    if not topic:
        return DEFAULT_DATASET
    return topic.strip().lower().replace("_", "-")


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


def _find_question_by_id(question_id: str) -> dict | None:
    """Scan all level files to find a question by ID."""
    for level_file in LEVEL_FILES.values():
        path = CYBER_DATA_ROOT / DEFAULT_DATASET / level_file
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
        self.rl: RLService = get_rl_service()

    # ── Public methods ────────────────────────────────────

    async def _ensure_topic_exists(self, topic_id: str) -> str:
        """Verify topic exists in DB or create it from default/slug."""
        result = await self.db.execute(select(Topic).where(Topic.id == topic_id))
        topic = result.scalar_one_or_none()

        if topic:
            return topic.id

        # Auto-create if missing
        new_topic = Topic(
            id=topic_id,
            title=topic_id.replace("-", " ").title(),
        )
        self.db.add(new_topic)
        await self.db.flush()  # Use flush to get ID without full commit yet if nested
        logger.info(f"[SESSION] Topic auto-created: {topic_id}")
        print(f"[SESSION] Topic ensured: {topic_id}")
        return new_topic.id

    async def start_session(
        self, user: User, topic: str | None = None
    ) -> StartSessionResponse:
        topic_slug = _normalize_topic(topic)
        
        # Ensure topic exists before session creation
        await self._ensure_topic_exists(topic_slug)
        
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

        # Cache live state
        _cache_set(session.id, {**state, "_topic": topic_slug})

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
        await self.db.commit()

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
        state = _cache_get(session_id) or self.rl.initial_state()
        topic_slug = state.pop("_topic", DEFAULT_DATASET)

        # ── Resolve question ──────────────────────────────
        json_q = _find_question_by_id(question_id)
        is_correct = False
        correct_answer = selected_answer
        q_explanation: str | None = None
        answered_difficulty = "medium"

        if json_q:
            correct_answer = json_q.get("correct_answer", selected_answer)
            q_explanation = json_q.get("explanation")
            answered_difficulty = json_q.get("difficulty", "medium").lower()
            is_correct = selected_answer.strip().upper() == correct_answer.strip().upper()
        else:
            db_result = await self.db.execute(
                select(Question).where(Question.id == question_id)
            )
            db_q = db_result.scalar_one_or_none()
            if db_q:
                correct_answer = db_q.correct_answer
                q_explanation = db_q.explanation
                answered_difficulty = db_q.difficulty
                is_correct = selected_answer.strip().lower() == correct_answer.strip().lower()
                db_q.times_served += 1
                if is_correct:
                    db_q.times_correct += 1

        # ── Update rich state vector ──────────────────────
        prev_accuracy = state.get("quiz_accuracy", 0.5)
        new_state = self._update_state(state, is_correct, time_taken)

        # Determine if this is an improvement for reward calc
        new_acc = new_state["quiz_accuracy"]
        is_improvement = new_acc > prev_accuracy
        is_repeated_mistake = (not is_correct) and state.get("quiz_accuracy", 0.5) < 0.4

        reward = RLService.calculate_reward(
            is_correct=is_correct,
            is_improvement=is_improvement,
            is_repeated_mistake=is_repeated_mistake,
        )

        # ── Persist attempt ───────────────────────────────
        attempt = QuestionAttempt(
            session_id=session_id,
            question_id=question_id if not json_q else None,
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
        if is_correct:
            session.correct_answers += 1

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

        # Update cache
        _cache_set(session_id, {**new_state, "_topic": topic_slug})

        if session_done:
            await self._finalize_session(session, new_state, user)

        await self.db.commit()

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
            streak=int(new_state.get("quiz_accuracy", 0) * 10),
        )

    async def end_session(self, user: User, session_id: str) -> SessionSummary:
        result = await self.db.execute(
            select(Session).where(Session.id == session_id, Session.user_id == user.id)
        )
        session = result.scalar_one_or_none()
        if not session:
            raise HTTPException(status_code=404, detail="Session not found.")

        state = _cache_get(session_id) or self.rl.initial_state()
        if session.status == "active":
            await self._finalize_session(session, state, user)

        _cache_delete(session_id)
        await self.db.commit()
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
        # Fallback: query DB
        result = await self.db.execute(
            select(Question)
            .where(Question.difficulty == difficulty)
            .limit(10)
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
        """
        Update the rich 7-feature state after each answer.
        Uses exponential moving average for accuracy metrics.
        """
        new = state.copy()
        alpha = 0.2   # EMA smoothing factor

        old_qa = state.get("quiz_accuracy", 0.5)
        new["quiz_accuracy"] = round(old_qa * (1 - alpha) + (1.0 if is_correct else 0.0) * alpha, 4)

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
            if is_correct := (session.correct_answers > 0):  # noqa: F841
                profile.current_streak += 1
                if profile.current_streak > profile.longest_streak:
                    profile.longest_streak = profile.current_streak

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
