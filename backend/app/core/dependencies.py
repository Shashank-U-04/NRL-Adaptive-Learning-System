"""
NRL Adaptive Learning System — Auth Dependencies

Validates Supabase-issued JWTs and syncs users into the application DB on
first login. Downstream routes depend on get_current_user without any
knowledge of how auth is performed.
"""

import logging

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import SUPABASE_JWT_SECRET
from app.core.database import get_db
from app.models.models import User
from app.services.auth_service import sync_user

logger = logging.getLogger(__name__)

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/token")


async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db),
) -> User:
    """Validate Supabase JWT and return the corresponding application User row.

    On first login the user and profile rows are auto-created (idempotent
    upsert). Raises 401 for invalid/expired tokens and 403 for deactivated
    accounts.
    """
    credentials_error = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    try:
        payload = jwt.decode(
            token,
            SUPABASE_JWT_SECRET,
            algorithms=["HS256"],
            audience="authenticated",
        )
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has expired",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except jwt.InvalidTokenError:
        raise credentials_error

    supabase_sub: str | None = payload.get("sub")
    email: str = payload.get("email", "")

    if not supabase_sub:
        raise credentials_error

    user = await sync_user(supabase_sub=supabase_sub, email=email, name="", db=db)

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account deactivated",
        )

    return user
