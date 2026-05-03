"""
NRL Adaptive Learning System — Auth Router

POST /auth/register, /auth/login, /auth/refresh, GET /auth/me, PUT /auth/profile
"""

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.core.database import get_db
from backend.app.schemas.schemas import (
    RegisterRequest, LoginRequest, TokenResponse, RefreshRequest,
    UserResponse, MeResponse, ProfileResponse, UpdateProfileRequest,
)
from backend.app.services.auth_service import AuthService
from backend.app.core.dependencies import get_current_user
from backend.app.models.models import User

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
async def register(data: RegisterRequest, db: AsyncSession = Depends(get_db)):
    service = AuthService(db)
    user = await service.register(data)
    tokens = await service.login(LoginRequest(email=data.email, password=data.password))
    return tokens


@router.post("/login", response_model=TokenResponse)
async def login(data: LoginRequest, db: AsyncSession = Depends(get_db)):
    service = AuthService(db)
    return await service.login(data)


@router.post("/refresh", response_model=TokenResponse)
async def refresh(data: RefreshRequest, db: AsyncSession = Depends(get_db)):
    service = AuthService(db)
    return await service.refresh_tokens(data.refresh_token)


@router.get("/me", response_model=MeResponse)
async def me(current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    await db.refresh(current_user, ["profile"])
    profile_data = None
    if current_user.profile:
        p = current_user.profile
        profile_data = ProfileResponse(
            knowledge_level=p.knowledge_level,
            current_streak=p.current_streak, longest_streak=p.longest_streak,
            total_xp=p.total_xp, sessions_completed=p.sessions_completed,
            total_questions_answered=p.total_questions_answered,
            total_correct=p.total_correct, accuracy=p.accuracy,
            daily_goal_minutes=p.daily_goal_minutes, last_active=p.last_active,
        )
    return MeResponse(user=UserResponse.model_validate(current_user), profile=profile_data)


@router.put("/profile", response_model=ProfileResponse)
async def update_profile(
    data: UpdateProfileRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await db.refresh(current_user, ["profile"])
    if current_user.profile:
        if data.daily_goal_minutes is not None:
            current_user.profile.daily_goal_minutes = data.daily_goal_minutes
    if data.name is not None:
        current_user.name = data.name
    await db.flush()
    p = current_user.profile
    return ProfileResponse(
        knowledge_level=p.knowledge_level,
        current_streak=p.current_streak, longest_streak=p.longest_streak,
        total_xp=p.total_xp, sessions_completed=p.sessions_completed,
        total_questions_answered=p.total_questions_answered,
        total_correct=p.total_correct, accuracy=p.accuracy,
        daily_goal_minutes=p.daily_goal_minutes, last_active=p.last_active,
    )
