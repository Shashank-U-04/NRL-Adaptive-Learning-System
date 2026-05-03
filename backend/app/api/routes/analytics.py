"""
NRL Adaptive Learning System — Analytics Router

GET /analytics/dashboard, /analytics/accuracy, /analytics/topics
"""

from fastapi import APIRouter, Depends
from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.core.database import get_db
from backend.app.core.dependencies import get_current_user
from backend.app.models.models import User, Session, LearnerMetric, Topic
from backend.app.schemas.schemas import DashboardResponse, AccuracyPoint, TopicMastery

router = APIRouter(prefix="/analytics", tags=["Analytics"])


@router.get("/dashboard", response_model=DashboardResponse)
async def student_dashboard(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await db.refresh(user, ["profile"])
    p = user.profile

    # Recent sessions
    result = await db.execute(
        select(Session).where(Session.user_id == user.id, Session.status == "completed")
        .order_by(desc(Session.started_at)).limit(5)
    )
    recent = result.scalars().all()
    recent_data = [
        {"id": s.id, "accuracy": s.accuracy, "reward": s.total_reward,
         "questions": s.questions_answered, "date": s.started_at.isoformat()}
        for s in recent
    ]

    # Weak topics
    metric_result = await db.execute(
        select(LearnerMetric, Topic.title)
        .join(Topic, LearnerMetric.topic_id == Topic.id)
        .where(LearnerMetric.user_id == user.id)
        .order_by(LearnerMetric.mastery_score).limit(3)
    )
    weak = metric_result.all()
    weak_data = [
        {"topic": name, "mastery": round(m.mastery_score, 1), "attempted": m.questions_attempted}
        for m, name in weak
    ]

    return DashboardResponse(
        knowledge_level=p.knowledge_level if p else "beginner",
        current_streak=p.current_streak if p else 0,
        longest_streak=p.longest_streak if p else 0,
        total_xp=p.total_xp if p else 0,
        sessions_completed=p.sessions_completed if p else 0,
        overall_accuracy=p.accuracy if p else 0.0,
        total_questions=p.total_questions_answered if p else 0,
        recent_sessions=recent_data,
        weak_topics=weak_data,
    )


@router.get("/accuracy", response_model=list[AccuracyPoint])
async def accuracy_trend(
    limit: int = 50,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Session).where(Session.user_id == user.id, Session.status == "completed")
        .order_by(Session.started_at).limit(limit)
    )
    sessions = result.scalars().all()
    return [
        AccuracyPoint(session_number=i + 1, accuracy=s.accuracy,
                       reward=s.total_reward, date=s.started_at)
        for i, s in enumerate(sessions)
    ]


@router.get("/topics", response_model=list[TopicMastery])
async def topic_mastery(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(LearnerMetric, Topic.title)
        .join(Topic, LearnerMetric.topic_id == Topic.id)
        .where(LearnerMetric.user_id == user.id)
        .order_by(desc(LearnerMetric.mastery_score))
    )
    rows = result.all()
    return [
        TopicMastery(
            topic_name=name, mastery_score=round(m.mastery_score, 1),
            questions_attempted=m.questions_attempted,
            accuracy=round(m.questions_correct / max(m.questions_attempted, 1) * 100, 1),
        )
        for m, name in rows
    ]
