"""
NRL 2.0 — Leaderboard Router

GET /leaderboard — Global XP leaderboard
"""

from fastapi import APIRouter, Depends
from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.core.database import get_db
from backend.app.models.models import User, Profile
from backend.app.schemas.schemas import LeaderboardEntry

router = APIRouter(prefix="/leaderboard", tags=["Leaderboard"])


@router.get("/", response_model=list[LeaderboardEntry])
async def get_leaderboard(limit: int = 50, db: AsyncSession = Depends(get_db)):
    """Global leaderboard ranked by total XP."""
    result = await db.execute(
        select(User, Profile)
        .join(Profile, User.id == Profile.user_id)
        .where(User.is_active == True)
        .order_by(desc(Profile.total_xp))
        .limit(limit)
    )
    rows = result.all()

    return [
        LeaderboardEntry(
            rank=i + 1,
            name=user.name,
            total_xp=profile.total_xp,
            accuracy=profile.accuracy,
            sessions_completed=profile.sessions_completed,
            knowledge_level=profile.knowledge_level,
        )
        for i, (user, profile) in enumerate(rows)
    ]
