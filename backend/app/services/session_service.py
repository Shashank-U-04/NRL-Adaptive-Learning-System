"""
NRL 2.0 — Session Service

Full adaptive quiz lifecycle:
  start → answer → next action → end → update profile
Uses in-memory session store instead of Redis.
"""

import logging
import random
from datetime import datetime, timezone

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import HTTPException, status

from backend.app.models.models import (
    User, Session, SessionEvent, Question, QuestionAttempt, Topic,
)
from backend.app.services.rl_service import get_rl_service, RLService, ACTIONS, ACTION_INDICES
from backend.app.core.session_store import session_store
from backend.app.core.config import SESSION_TTL_SECONDS
from backend.app.schemas.schemas import QuestionPayload, StartSessionResponse, AnswerResponse, SessionSummary

logger = logging.getLogger(__name__)

DIFFICULTY_MAP = {
    "Present_Easy_Question": "easy",
    "Present_Medium_Question": "medium",
    "Present_Hard_Question": "hard",
}


class SessionService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.rl: RLService = get_rl_service()

    async def start_session(self, user: User, topic_id: str | None = None) -> StartSessionResponse:
        session = Session(user_id=user.id, status="active")
        self.db.add(session)
        await self.db.flush()

        state = self.rl.initial_state()
        action_name, confidence, explanation = self.rl.recommend_action(state)

        # Cache state in memory
        await session_store.set(f"session:{session.id}", state, SESSION_TTL_SECONDS)

        # Fetch question if action is a question type
        question = None
        if action_name in DIFFICULTY_MAP:
            question = await self._fetch_question(DIFFICULTY_MAP[action_name], topic_id)

        # Log event
        event = SessionEvent(
            session_id=session.id, step_number=0,
            state_before=state, action_taken=action_name,
            reward=0.0, state_after=state, explanation=explanation,
        )
        self.db.add(event)

        return StartSessionResponse(
            session_id=session.id, initial_state=state,
            first_action=action_name, explanation=explanation,
            confidence=confidence, question=question,
        )

    async def process_answer(
        self, user: User, session_id: str, question_id: str,
        selected_answer: str, time_taken: int,
    ) -> AnswerResponse:
        session = await self._get_active_session(session_id, user.id)
        state = await session_store.get(f"session:{session_id}")
        if state is None:
            state = self.rl.initial_state()

        # Check answer
        result = await self.db.execute(select(Question).where(Question.id == question_id))
        question = result.scalar_one_or_none()

        is_correct = False
        correct_answer = selected_answer
        q_explanation = None

        if question:
            is_correct = selected_answer.strip().lower() == question.correct_answer.strip().lower()
            correct_answer = question.correct_answer
            q_explanation = question.explanation
            question.times_served += 1
            if is_correct:
                question.times_correct += 1

        # Calculate reward and update state
        reward = self._calculate_reward(state, is_correct)
        new_state = self._update_state(state, is_correct)

        # Record attempt
        attempt = QuestionAttempt(
            session_id=session_id, question_id=question_id, user_id=user.id,
            selected_answer=selected_answer, is_correct=is_correct,
            time_taken_seconds=time_taken,
            difficulty=["easy", "medium", "hard"][min(state.get("question_difficulty", 0), 2)],
        )
        self.db.add(attempt)

        # Update session counters
        session.total_steps += 1
        session.questions_answered += 1
        session.total_reward += reward
        if is_correct:
            session.correct_answers += 1

        # Get next recommendation
        action_name, confidence, explanation = self.rl.recommend_action(new_state)
        session_done = action_name == "End_Session" or session.total_steps >= 30

        if session.total_steps >= 30:
            action_name = "End_Session"
            explanation = "Session reached maximum steps — ending session"
            session_done = True

        # Fetch next question
        next_question = None
        if not session_done and action_name in DIFFICULTY_MAP:
            next_question = await self._fetch_question(DIFFICULTY_MAP[action_name])

        # Log event
        event = SessionEvent(
            session_id=session_id, step_number=session.total_steps,
            state_before=state, action_taken=action_name,
            reward=reward, state_after=new_state, explanation=explanation,
        )
        self.db.add(event)

        # Save updated state
        await session_store.set(f"session:{session_id}", new_state, SESSION_TTL_SECONDS)

        if session_done:
            await self._finalize_session(session, new_state, user)

        return AnswerResponse(
            is_correct=is_correct, correct_answer=correct_answer,
            explanation=q_explanation, reward=reward,
            next_action=action_name, action_explanation=explanation,
            confidence=confidence, next_question=next_question,
            session_done=session_done, updated_state=new_state,
            streak=new_state["consecutive_correct"],
        )

    async def end_session(self, user: User, session_id: str) -> SessionSummary:
        session = await self._get_active_session(session_id, user.id)
        state = await session_store.get(f"session:{session_id}") or self.rl.initial_state()
        await self._finalize_session(session, state, user)
        await session_store.delete(f"session:{session_id}")
        return self._build_summary(session)

    # ── Private Helpers ──────────────────────────────────

    async def _get_active_session(self, session_id: str, user_id: str) -> Session:
        result = await self.db.execute(
            select(Session).where(Session.id == session_id, Session.user_id == user_id, Session.status == "active")
        )
        session = result.scalar_one_or_none()
        if not session:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Active session not found")
        return session

    async def _fetch_question(self, difficulty: str, topic_id: str | None = None) -> QuestionPayload | None:
        stmt = select(Question).where(Question.difficulty == difficulty, Question.is_active == True)
        if topic_id:
            stmt = stmt.where(Question.topic_id == topic_id)

        # SQLite-compatible random ordering
        result = await self.db.execute(stmt)
        questions = result.scalars().all()
        if not questions:
            return None

        q = random.choice(questions)

        # Get topic name
        topic_result = await self.db.execute(select(Topic).where(Topic.id == q.topic_id))
        topic = topic_result.scalar_one_or_none()

        return QuestionPayload(
            id=q.id, text=q.text, options=q.options,
            difficulty=q.difficulty, topic_name=topic.name if topic else "General",
            hint_available=q.hint is not None,
        )

    def _calculate_reward(self, state: dict, is_correct: bool) -> float:
        reward = 0.0
        diff = state.get("question_difficulty", 0)

        if is_correct:
            reward += [3, 5, 10][min(diff, 2)]
            if diff < state["knowledge_level"]:
                reward -= 8
            if state["consecutive_correct"] + 1 >= 3:
                reward += 20
        else:
            reward -= 5
            if diff > state["knowledge_level"]:
                reward -= 12
            if state["consecutive_wrong"] + 1 >= 3:
                reward -= 15

        return reward

    def _update_state(self, state: dict, is_correct: bool) -> dict:
        new = state.copy()
        if is_correct:
            new["consecutive_correct"] += 1
            new["consecutive_wrong"] = 0
            if new["consecutive_correct"] >= 3:
                new["knowledge_level"] = min(2, new["knowledge_level"] + 1)
                new["consecutive_correct"] = 0
            if random.random() < 0.3:
                new["engagement_score"] = min(2, new["engagement_score"] + 1)
        else:
            new["consecutive_correct"] = 0
            new["consecutive_wrong"] += 1
            if random.random() < 0.4:
                new["engagement_score"] = max(0, new["engagement_score"] - 1)
        return new

    async def _finalize_session(self, session: Session, state: dict, user: User) -> None:
        session.status = "completed"
        session.ended_at = datetime.now(timezone.utc)
        session.final_knowledge_level = state["knowledge_level"]

        await self.db.refresh(user, ["profile"])
        if user.profile:
            user.profile.sessions_completed += 1
            user.profile.total_questions_answered += session.questions_answered
            user.profile.total_correct += session.correct_answers
            user.profile.total_xp += max(0, int(session.total_reward))
            user.profile.last_active = datetime.now(timezone.utc)
            user.profile.current_streak += 1
            if user.profile.current_streak > user.profile.longest_streak:
                user.profile.longest_streak = user.profile.current_streak

            kl_map = {0: "beginner", 1: "intermediate", 2: "advanced"}
            user.profile.knowledge_level = kl_map.get(state["knowledge_level"], "beginner")

        logger.info(f"Session {session.id} completed — {session.correct_answers}/{session.questions_answered}")

    def _build_summary(self, session: Session) -> SessionSummary:
        return SessionSummary(
            session_id=session.id,
            total_questions=session.questions_answered,
            correct_answers=session.correct_answers,
            accuracy=session.accuracy,
            total_reward=session.total_reward,
            duration_seconds=session.duration_seconds or 0,
            hints_used=session.hints_used,
            xp_earned=max(0, int(session.total_reward)),
        )
