"""
NRL Adaptive Learning System — PostgreSQL ORM Models

Tables:
  users, topics, learning_modules, learning_events, module_progress,
  questions, sessions, question_attempts, learner_metrics,
  profiles, session_events

All indexes match the architecture plan for query performance.
"""

import uuid
from datetime import datetime, timezone
from sqlalchemy import (
    Column, String, Boolean, Float, Integer,
    DateTime, ForeignKey, Text, Index, UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import relationship

from app.core.database import Base


def _uuid() -> str:
    return str(uuid.uuid4())


# ─────────────────────────────────────────────────────────
#  Users & Auth
# ─────────────────────────────────────────────────────────

class User(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True, default=_uuid)
    name = Column(String(100), nullable=False)
    email = Column(String(255), unique=True, index=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    role = Column(String(20), default="student", nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    profile = relationship("Profile", back_populates="user", uselist=False, lazy="selectin")
    sessions = relationship("Session", back_populates="user")


class Profile(Base):
    __tablename__ = "profiles"

    id = Column(String, primary_key=True, default=_uuid)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False)
    knowledge_level = Column(String(20), default="beginner")
    current_streak = Column(Integer, default=0)
    longest_streak = Column(Integer, default=0)
    total_xp = Column(Integer, default=0)
    sessions_completed = Column(Integer, default=0)
    total_questions_answered = Column(Integer, default=0)
    total_correct = Column(Integer, default=0)
    daily_goal_minutes = Column(Integer, default=30)
    last_active = Column(DateTime(timezone=True), nullable=True)

    user = relationship("User", back_populates="profile")

    @property
    def accuracy(self) -> float:
        if self.total_questions_answered == 0:
            return 0.0
        return round(self.total_correct / self.total_questions_answered * 100, 1)


# ─────────────────────────────────────────────────────────
#  Topics (Allowlist for security)
# ─────────────────────────────────────────────────────────

class Topic(Base):
    __tablename__ = "topics"

    id = Column(String(50), primary_key=True)       # e.g. "sql-injection"
    title = Column(String(100), nullable=False)
    description = Column(Text, nullable=True)
    order_index = Column(Integer, default=0)
    is_active = Column(Boolean, default=True)


# ─────────────────────────────────────────────────────────
#  Learning Modules  (AI-generated, versioned, idempotent)
# ─────────────────────────────────────────────────────────

class LearningModule(Base):
    __tablename__ = "learning_modules"

    id = Column(String, primary_key=True, default=_uuid)
    topic_id = Column(String(50), ForeignKey("topics.id"), nullable=False)
    version = Column(Integer, default=1)
    is_active = Column(Boolean, default=True)
    is_ai_generated = Column(Boolean, default=False, nullable=False)
    content = Column(JSONB, nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    # Enforce: only ONE active module per topic at a time (idempotency guarantee)
    __table_args__ = (
        Index("idx_unique_active_topic", "topic_id", unique=True,
              postgresql_where=Column("is_active") == True),  # noqa: E712
    )


# ─────────────────────────────────────────────────────────
#  Learning Telemetry
# ─────────────────────────────────────────────────────────

class LearningEvent(Base):
    __tablename__ = "learning_events"

    id = Column(String, primary_key=True, default=_uuid)
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    topic_id = Column(String(50), ForeignKey("topics.id"), nullable=False)
    event_type = Column(String(20), nullable=False)   # 'mcq' | 'lab'
    is_correct = Column(Boolean, nullable=True)
    details = Column(JSONB, nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    # Performance index per plan
    __table_args__ = (
        Index("idx_learning_events_user_topic", "user_id", "topic_id"),
    )


class ModuleProgress(Base):
    __tablename__ = "module_progress"

    id = Column(String, primary_key=True, default=_uuid)
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    topic_id = Column(String(50), ForeignKey("topics.id"), nullable=False)
    is_completed = Column(Boolean, default=False)
    completed_lessons = Column(JSONB, default=list)  # List of lesson IDs
    completed_labs = Column(JSONB, default=list)     # List of lab IDs
    quiz_scores = Column(JSONB, default=list)        # List of quiz score records
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    __table_args__ = (
        UniqueConstraint("user_id", "topic_id", name="uq_module_progress_user_topic"),
    )


# ─────────────────────────────────────────────────────────
#  Questions  (Quiz Mode)
# ─────────────────────────────────────────────────────────

class Question(Base):
    __tablename__ = "questions"

    id = Column(String, primary_key=True, default=_uuid)
    topic_id = Column(String(50), ForeignKey("topics.id"), nullable=False)
    difficulty = Column(String(10), nullable=False)   # 'easy' | 'medium' | 'hard'
    source = Column(String(20), default="dataset")    # 'dataset' | 'ai'
    text = Column(Text, nullable=False)
    options = Column(JSONB, nullable=False)
    correct_answer = Column(String(10), nullable=False)
    explanation = Column(Text, nullable=True)
    hint = Column(Text, nullable=True)
    times_served = Column(Integer, default=0)
    times_correct = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    # Performance index per plan
    __table_args__ = (
        Index("idx_questions_topic_difficulty", "topic_id", "difficulty"),
    )


# ─────────────────────────────────────────────────────────
#  Quiz Sessions & RL State
# ─────────────────────────────────────────────────────────

class Session(Base):
    __tablename__ = "sessions"

    id = Column(String, primary_key=True, default=_uuid)
    user_id = Column(String, ForeignKey("users.id"), nullable=False, index=True)
    topic_id = Column(String(50), ForeignKey("topics.id"), nullable=True)
    status = Column(String(20), default="active")           # 'active' | 'completed'
    state_vector = Column(JSONB, nullable=True)             # Rich RL features snapshot
    last_action = Column(Integer, nullable=True)            # Last RL action index
    last_reward = Column(Float, nullable=True)              # Last computed reward
    total_steps = Column(Integer, default=0)
    questions_answered = Column(Integer, default=0)
    correct_answers = Column(Integer, default=0)
    total_reward = Column(Float, default=0.0)
    hints_used = Column(Integer, default=0)
    started_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    ended_at = Column(DateTime(timezone=True), nullable=True)
    final_knowledge_level = Column(Integer, nullable=True)

    user = relationship("User", back_populates="sessions")
    events = relationship("SessionEvent", back_populates="session")

    # Performance index per plan
    __table_args__ = (
        Index("idx_sessions_user", "user_id"),
    )

    @property
    def accuracy(self) -> float:
        if self.questions_answered == 0:
            return 0.0
        return round(self.correct_answers / self.questions_answered * 100, 1)

    @property
    def duration_seconds(self) -> int | None:
        if self.ended_at and self.started_at:
            return int((self.ended_at - self.started_at).total_seconds())
        return None


class SessionEvent(Base):
    """Detailed RL step log for traceability and future training."""
    __tablename__ = "session_events"

    id = Column(String, primary_key=True, default=_uuid)
    session_id = Column(String, ForeignKey("sessions.id"), nullable=False, index=True)
    step_number = Column(Integer, nullable=False)
    state_before = Column(JSONB, nullable=True)
    action_taken = Column(String(50), nullable=True)
    reward = Column(Float, nullable=True)
    state_after = Column(JSONB, nullable=True)
    explanation = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    session = relationship("Session", back_populates="events")


class QuestionAttempt(Base):
    __tablename__ = "question_attempts"

    id = Column(String, primary_key=True, default=_uuid)
    session_id = Column(String, ForeignKey("sessions.id"), nullable=False, index=True)
    question_id = Column(String, ForeignKey("questions.id"), nullable=True)
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    selected_answer = Column(String(10), nullable=False)
    is_correct = Column(Boolean, nullable=False)
    time_taken_seconds = Column(Integer, default=0)
    difficulty = Column(String(10), nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))


# ─────────────────────────────────────────────────────────
#  Learner Metrics (per user per topic)
# ─────────────────────────────────────────────────────────

class LearnerMetric(Base):
    __tablename__ = "learner_metrics"

    id = Column(String, primary_key=True, default=_uuid)
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    topic_id = Column(String(50), ForeignKey("topics.id"), nullable=False)
    xp = Column(Integer, default=0)
    mastery_score = Column(Float, default=0.0)
    questions_attempted = Column(Integer, default=0)
    questions_correct = Column(Integer, default=0)
    avg_time_seconds = Column(Float, default=0.0)
    last_practiced = Column(DateTime(timezone=True), nullable=True)
    difficulty_history = Column(JSONB, nullable=True)   # Tracks progression over time

    __table_args__ = (
        UniqueConstraint("user_id", "topic_id", name="uq_learner_metrics_user_topic"),
    )
