"""
NRL Adaptive Learning System — Pydantic Schemas

All request/response models for the API.
"""

from pydantic import BaseModel, EmailStr, Field, field_validator
from datetime import datetime
from typing import Optional
import re


# ── Auth ─────────────────────────────────────────────────
class RegisterRequest(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    email: EmailStr
    password: str = Field(..., min_length=8, max_length=128)

    @field_validator("password")
    @classmethod
    def validate_password(cls, v: str) -> str:
        if not re.search(r"[A-Z]", v):
            raise ValueError("Must contain at least one uppercase letter")
        if not re.search(r"[a-z]", v):
            raise ValueError("Must contain at least one lowercase letter")
        if not re.search(r"\d", v):
            raise ValueError("Must contain at least one digit")
        return v


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int


class RefreshRequest(BaseModel):
    refresh_token: str


class UserResponse(BaseModel):
    id: str
    name: str
    email: str
    role: str
    is_active: bool
    created_at: datetime
    model_config = {"from_attributes": True}


class ProfileResponse(BaseModel):
    knowledge_level: str
    current_streak: int
    longest_streak: int
    total_xp: int
    sessions_completed: int
    total_questions_answered: int
    total_correct: int
    accuracy: float
    daily_goal_minutes: int
    last_active: datetime | None
    model_config = {"from_attributes": True}


class MeResponse(BaseModel):
    user: UserResponse
    profile: ProfileResponse | None


class UpdateProfileRequest(BaseModel):
    daily_goal_minutes: int | None = None
    name: str | None = None


# ── Session / Quiz ───────────────────────────────────────
class StartSessionRequest(BaseModel):
    topic: str | None = None
    topic_id: str | None = None


class QuestionPayload(BaseModel):
    id: str
    text: str
    options: dict
    difficulty: str
    topic_name: str
    hint_available: bool
    source: str = "dataset"


class StartSessionResponse(BaseModel):
    session_id: str
    initial_state: dict
    first_action: str
    explanation: str
    confidence: float
    question: QuestionPayload | None = None


class AnswerRequest(BaseModel):
    session_id: str
    question_id: str
    selected_answer: str
    time_taken_seconds: int = Field(default=0, ge=0)


class AnswerResponse(BaseModel):
    is_correct: bool
    correct_answer: str
    explanation: str | None
    reward: float
    next_action: str
    action_explanation: str
    confidence: float
    next_question: QuestionPayload | None = None
    session_done: bool = False
    updated_state: dict
    streak: int


class EndSessionRequest(BaseModel):
    session_id: str


class SessionSummary(BaseModel):
    session_id: str
    total_questions: int
    correct_answers: int
    accuracy: float
    total_reward: float
    duration_seconds: int
    hints_used: int
    xp_earned: int


class SessionHistoryItem(BaseModel):
    session_id: str
    status: str
    accuracy: float
    total_reward: float
    questions_answered: int
    duration_seconds: int | None
    started_at: datetime
    model_config = {"from_attributes": True}


# ── Analytics ────────────────────────────────────────────
class DashboardResponse(BaseModel):
    knowledge_level: str
    current_streak: int
    longest_streak: int
    total_xp: int
    sessions_completed: int
    overall_accuracy: float
    total_questions: int
    recent_sessions: list[dict]
    weak_topics: list[dict]


class AccuracyPoint(BaseModel):
    session_number: int
    accuracy: float
    reward: float
    date: datetime


class TopicMastery(BaseModel):
    topic_name: str
    mastery_score: float
    questions_attempted: int
    accuracy: float


# ── Leaderboard ──────────────────────────────────────────
class LeaderboardEntry(BaseModel):
    rank: int
    name: str
    total_xp: int
    accuracy: float
    sessions_completed: int
    knowledge_level: str
