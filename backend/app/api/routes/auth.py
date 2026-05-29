"""
NRL Adaptive Learning System — Auth Router

GET  /auth/me      — return current user + profile (Supabase JWT required)
PUT  /auth/profile — update display name / daily goal
"""

import logging

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.models.models import Profile, User
from app.schemas.schemas import (
    MeResponse,
    ProfileResponse,
    UpdateProfileRequest,
    UserResponse,
)

router = APIRouter(prefix="/auth", tags=["Authentication"])
logger = logging.getLogger("nrl.auth")


def _to_profile_response(p: Profile) -> ProfileResponse:
    return ProfileResponse(
        knowledge_level=p.knowledge_level,
        current_streak=p.current_streak,
        longest_streak=p.longest_streak,
        total_xp=p.total_xp,
        sessions_completed=p.sessions_completed,
        total_questions_answered=p.total_questions_answered,
        total_correct=p.total_correct,
        accuracy=p.accuracy,
        daily_goal_minutes=p.daily_goal_minutes,
        last_active=p.last_active,
    )


async def _ensure_profile(user: User, db: AsyncSession) -> Profile:
    """Return ``user.profile``, creating a default row if missing.

    Mirrors ``auth_service.sync_user`` which seeds a profile on first login;
    this guard covers the rare case where that step was skipped (legacy
    migration, manual user insert, race during signup).
    """
    if user.profile is not None:
        return user.profile

    logger.warning("Auto-creating missing profile for user_id=%s", user.id)
    profile = Profile(user_id=user.id)
    db.add(profile)
    await db.flush()
    await db.refresh(user, ["profile"])
    return user.profile


@router.get("/me", response_model=MeResponse)
async def me(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await db.refresh(current_user, ["profile"])
    profile_data = (
        _to_profile_response(current_user.profile) if current_user.profile else None
    )
    return MeResponse(
        user=UserResponse.model_validate(current_user),
        profile=profile_data,
    )


@router.put("/profile", response_model=ProfileResponse)
async def update_profile(
    data: UpdateProfileRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await db.refresh(current_user, ["profile"])
    profile = await _ensure_profile(current_user, db)

    if data.daily_goal_minutes is not None:
        profile.daily_goal_minutes = data.daily_goal_minutes
    if data.name is not None:
        current_user.name = data.name
    await db.flush()
    return _to_profile_response(profile)
