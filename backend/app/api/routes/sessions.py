"""
NRL 2.0 — Session Router

POST /sessions/start, /sessions/answer, /sessions/end
GET  /sessions/history
"""

from fastapi import APIRouter, Depends
from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.core.database import get_db
from backend.app.core.dependencies import get_current_user
from backend.app.models.models import User, Session
from backend.app.schemas.schemas import (
    StartSessionRequest, StartSessionResponse,
    AnswerRequest, AnswerResponse,
    EndSessionRequest, SessionSummary, SessionHistoryItem,
)
from backend.app.services.session_service import SessionService

router = APIRouter(prefix="/sessions", tags=["Learning Sessions"])


@router.post("/start", response_model=StartSessionResponse)
async def start_session(
    data: StartSessionRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    service = SessionService(db)
    return await service.start_session(user, data.topic_id)


@router.post("/answer", response_model=AnswerResponse)
async def submit_answer(
    data: AnswerRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    service = SessionService(db)
    return await service.process_answer(
        user=user, session_id=data.session_id, question_id=data.question_id,
        selected_answer=data.selected_answer, time_taken=data.time_taken_seconds,
    )


@router.post("/end", response_model=SessionSummary)
async def end_session(
    data: EndSessionRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    service = SessionService(db)
    return await service.end_session(user, data.session_id)


@router.get("/history", response_model=list[SessionHistoryItem])
async def session_history(
    limit: int = 20,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Session).where(Session.user_id == user.id)
        .order_by(desc(Session.started_at)).limit(limit)
    )
    sessions = result.scalars().all()
    return [
        SessionHistoryItem(
            session_id=s.id, status=s.status, accuracy=s.accuracy,
            total_reward=s.total_reward, questions_answered=s.questions_answered,
            duration_seconds=s.duration_seconds, started_at=s.started_at,
        )
        for s in sessions
    ]
