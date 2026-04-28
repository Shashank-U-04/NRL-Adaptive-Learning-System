"""
NRL 2.0 — Database Models

All models use String(36) primary keys with uuid4 defaults.
JSON type instead of JSONB for SQLite compatibility.

Tables:
  users, profiles, topics, questions, sessions,
  session_events, question_attempts, learner_metrics
"""

import uuid
import enum
from datetime import datetime, timezone
from sqlalchemy import (
    String, Boolean, Integer, Float, DateTime, ForeignKey, Text, JSON,
    Index, Enum as SAEnum,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from backend.app.core.database import Base


def new_uuid() -> str:
    return str(uuid.uuid4())


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


# ── Enums ────────────────────────────────────────────────
class UserRole(str, enum.Enum):
    STUDENT = "student"
    TEACHER = "teacher"
    ADMIN = "admin"


class KnowledgeLevel(str, enum.Enum):
    BEGINNER = "beginner"
    INTERMEDIATE = "intermediate"
    ADVANCED = "advanced"


class Difficulty(str, enum.Enum):
    EASY = "easy"
    MEDIUM = "medium"
    HARD = "hard"


class SessionStatus(str, enum.Enum):
    ACTIVE = "active"
    COMPLETED = "completed"
    ABANDONED = "abandoned"


class ActionType(str, enum.Enum):
    PRESENT_EASY = "present_easy_question"
    PRESENT_MEDIUM = "present_medium_question"
    PRESENT_HARD = "present_hard_question"
    GIVE_HINT = "give_hint"
    REVIEW_PREVIOUS = "review_previous_topic"
    MOVE_NEXT = "move_to_next_topic"
    END_SESSION = "end_session"


# ── Users ────────────────────────────────────────────────
class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[str] = mapped_column(String(20), default="student")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, onupdate=utcnow)

    # Relationships
    profile: Mapped["Profile"] = relationship(back_populates="user", uselist=False, cascade="all, delete-orphan")
    sessions: Mapped[list["Session"]] = relationship(back_populates="user", cascade="all, delete-orphan")


# ── Profiles ─────────────────────────────────────────────
class Profile(Base):
    __tablename__ = "profiles"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), unique=True, nullable=False)
    knowledge_level: Mapped[str] = mapped_column(String(20), default="beginner")
    current_streak: Mapped[int] = mapped_column(Integer, default=0)
    longest_streak: Mapped[int] = mapped_column(Integer, default=0)
    total_xp: Mapped[int] = mapped_column(Integer, default=0)
    sessions_completed: Mapped[int] = mapped_column(Integer, default=0)
    total_questions_answered: Mapped[int] = mapped_column(Integer, default=0)
    total_correct: Mapped[int] = mapped_column(Integer, default=0)
    daily_goal_minutes: Mapped[int] = mapped_column(Integer, default=30)
    last_active: Mapped[datetime | None] = mapped_column(DateTime, default=None)

    user: Mapped["User"] = relationship(back_populates="profile")

    @property
    def accuracy(self) -> float:
        if self.total_questions_answered == 0:
            return 0.0
        return round(self.total_correct / self.total_questions_answered * 100, 1)


# ── Topics ───────────────────────────────────────────────
class Topic(Base):
    __tablename__ = "topics"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    name: Mapped[str] = mapped_column(String(200), nullable=False, unique=True)
    description: Mapped[str | None] = mapped_column(Text, default=None)
    order_index: Mapped[int] = mapped_column(Integer, default=0)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    questions: Mapped[list["Question"]] = relationship(back_populates="topic", cascade="all, delete-orphan")


# ── Questions ────────────────────────────────────────────
class Question(Base):
    __tablename__ = "questions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    topic_id: Mapped[str] = mapped_column(String(36), ForeignKey("topics.id"), nullable=False)
    difficulty: Mapped[str] = mapped_column(String(20), nullable=False)
    text: Mapped[str] = mapped_column(Text, nullable=False)
    options: Mapped[dict] = mapped_column(JSON, nullable=False)
    correct_answer: Mapped[str] = mapped_column(String(500), nullable=False)
    explanation: Mapped[str | None] = mapped_column(Text, default=None)
    hint: Mapped[str | None] = mapped_column(Text, default=None)
    times_served: Mapped[int] = mapped_column(Integer, default=0)
    times_correct: Mapped[int] = mapped_column(Integer, default=0)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    topic: Mapped["Topic"] = relationship(back_populates="questions")
    attempts: Mapped[list["QuestionAttempt"]] = relationship(back_populates="question")

    __table_args__ = (
        Index("ix_questions_topic_diff", "topic_id", "difficulty"),
    )


# ── Sessions ─────────────────────────────────────────────
class Session(Base):
    __tablename__ = "sessions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="active")
    total_reward: Mapped[float] = mapped_column(Float, default=0.0)
    total_steps: Mapped[int] = mapped_column(Integer, default=0)
    questions_answered: Mapped[int] = mapped_column(Integer, default=0)
    correct_answers: Mapped[int] = mapped_column(Integer, default=0)
    hints_used: Mapped[int] = mapped_column(Integer, default=0)
    final_knowledge_level: Mapped[int | None] = mapped_column(Integer, default=None)
    started_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    ended_at: Mapped[datetime | None] = mapped_column(DateTime, default=None)

    user: Mapped["User"] = relationship(back_populates="sessions")
    events: Mapped[list["SessionEvent"]] = relationship(back_populates="session", cascade="all, delete-orphan")
    attempts: Mapped[list["QuestionAttempt"]] = relationship(back_populates="session", cascade="all, delete-orphan")

    __table_args__ = (
        Index("ix_sessions_user", "user_id"),
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


# ── Session Events ───────────────────────────────────────
class SessionEvent(Base):
    __tablename__ = "session_events"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    session_id: Mapped[str] = mapped_column(String(36), ForeignKey("sessions.id"), nullable=False)
    step_number: Mapped[int] = mapped_column(Integer, nullable=False)
    state_before: Mapped[dict] = mapped_column(JSON, nullable=False)
    action_taken: Mapped[str] = mapped_column(String(50), nullable=False)
    reward: Mapped[float] = mapped_column(Float, nullable=False)
    state_after: Mapped[dict] = mapped_column(JSON, nullable=False)
    explanation: Mapped[str | None] = mapped_column(Text, default=None)
    timestamp: Mapped[datetime] = mapped_column(DateTime, default=utcnow)

    session: Mapped["Session"] = relationship(back_populates="events")


# ── Question Attempts ───────────────────────────────────
class QuestionAttempt(Base):
    __tablename__ = "question_attempts"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    session_id: Mapped[str] = mapped_column(String(36), ForeignKey("sessions.id"), nullable=False)
    question_id: Mapped[str] = mapped_column(String(36), ForeignKey("questions.id"), nullable=True)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), nullable=False)
    selected_answer: Mapped[str] = mapped_column(String(500), nullable=False)
    is_correct: Mapped[bool] = mapped_column(Boolean, nullable=False)
    time_taken_seconds: Mapped[int] = mapped_column(Integer, default=0)
    hint_used: Mapped[bool] = mapped_column(Boolean, default=False)
    difficulty: Mapped[str] = mapped_column(String(20), nullable=False)
    answered_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)

    session: Mapped["Session"] = relationship(back_populates="attempts")
    question: Mapped["Question | None"] = relationship(back_populates="attempts")

    __table_args__ = (
        Index("ix_attempts_user", "user_id"),
    )


# ── Learner Metrics (per-topic) ──────────────────────────
class LearnerMetric(Base):
    __tablename__ = "learner_metrics"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), nullable=False)
    topic_id: Mapped[str] = mapped_column(String(36), ForeignKey("topics.id"), nullable=False)
    mastery_score: Mapped[float] = mapped_column(Float, default=0.0)
    questions_attempted: Mapped[int] = mapped_column(Integer, default=0)
    questions_correct: Mapped[int] = mapped_column(Integer, default=0)
    avg_time_seconds: Mapped[float] = mapped_column(Float, default=0.0)
    last_practiced: Mapped[datetime | None] = mapped_column(DateTime, default=None)

    __table_args__ = (
        Index("ix_learner_metrics_user_topic", "user_id", "topic_id", unique=True),
    )
