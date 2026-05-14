"""
NRL Adaptive Learning System — Auth Dependencies

Validates Supabase-issued JWTs and syncs users into the application DB on
first login. Downstream routes depend on get_current_user without any
knowledge of how auth is performed.
"""

import base64
import logging

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import SUPABASE_JWT_SECRET

# Supabase sometimes signs with the raw secret string, sometimes with the
# base64-decoded bytes.  Pre-compute both so we try both on each request.
_JWT_KEYS: list[str | bytes] = [SUPABASE_JWT_SECRET]
try:
    _b64_decoded = base64.b64decode(SUPABASE_JWT_SECRET)
    if _b64_decoded != SUPABASE_JWT_SECRET.encode():
        _JWT_KEYS.append(_b64_decoded)
except Exception:
    pass
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

    payload: dict | None = None
    last_error: Exception | None = None
    for key in _JWT_KEYS:
        try:
            payload = jwt.decode(token, key, algorithms=["HS256"], audience="authenticated")
            break
        except jwt.ExpiredSignatureError:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token has expired",
                headers={"WWW-Authenticate": "Bearer"},
            )
        except jwt.InvalidTokenError as exc:
            last_error = exc
            continue

    if payload is None:
        logger.debug("JWT validation failed with all keys: %s", last_error)
        raise credentials_error

    supabase_sub: str | None = payload.get("sub")
    email: str = payload.get("email", "")

    if not supabase_sub:
        raise credentials_error

    metadata: dict = payload.get("user_metadata", {}) or {}
    display_name: str = (
        metadata.get("full_name")
        or metadata.get("name")
        or email.split("@")[0]
    )

    user = await sync_user(supabase_sub=supabase_sub, email=email, name=display_name, db=db)

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account deactivated",
        )

    return user
