"""
NRL Adaptive Learning System — Auth Service

Register, login, refresh tokens, fetch user.
"""

import logging
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import HTTPException, status

from app.models.models import User, Profile
from app.core.security import hash_password, verify_password, create_access_token, create_refresh_token, decode_token
from app.core.config import ACCESS_TOKEN_EXPIRE_MINUTES
from app.schemas.schemas import RegisterRequest, LoginRequest, TokenResponse

logger = logging.getLogger(__name__)


class AuthService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def register(self, data: RegisterRequest) -> User:
        result = await self.db.execute(select(User).where(User.email == data.email))
        if result.scalar_one_or_none():
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered")

        user = User(name=data.name, email=data.email, password_hash=hash_password(data.password))
        self.db.add(user)
        await self.db.flush()

        profile = Profile(user_id=user.id)
        self.db.add(profile)
        await self.db.flush()

        logger.info(f"New user registered: {user.email}")
        return user

    async def login(self, data: LoginRequest) -> TokenResponse:
        result = await self.db.execute(select(User).where(User.email == data.email))
        user = result.scalar_one_or_none()

        if not user or not verify_password(data.password, user.password_hash):
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password")
        if not user.is_active:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account deactivated")

        token_data = {"sub": user.id, "email": user.email, "role": user.role}
        return TokenResponse(
            access_token=create_access_token(token_data),
            refresh_token=create_refresh_token(token_data),
            expires_in=ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        )

    async def refresh_tokens(self, refresh_token: str) -> TokenResponse:
        payload = decode_token(refresh_token)
        if payload.get("type") != "refresh":
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Expected refresh token")

        result = await self.db.execute(select(User).where(User.id == payload.get("sub")))
        user = result.scalar_one_or_none()
        if not user or not user.is_active:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found or deactivated")

        token_data = {"sub": user.id, "email": user.email, "role": user.role}
        return TokenResponse(
            access_token=create_access_token(token_data),
            refresh_token=create_refresh_token(token_data),
            expires_in=ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        )
