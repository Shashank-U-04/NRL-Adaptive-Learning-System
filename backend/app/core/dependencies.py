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
from app.core.database import get_db
from app.models.models import User
from app.services.auth_service import sync_user

logger = logging.getLogger(__name__)

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/token", auto_error=False)


def _candidate_keys(secret: str) -> list[str | bytes]:
    """Return every plausible HS256 key derived from the configured secret.

    Supabase exposes the JWT secret as a string in the dashboard. Depending on
    project age, the displayed value may be the raw signing key OR a base64
    representation of the raw signing key. We try both so the same backend code
    works for any Supabase project the user has configured.
    """
    keys: list[str | bytes] = [secret]
    try:
        decoded = base64.b64decode(secret, validate=True)
        if decoded and decoded != secret.encode():
            keys.append(decoded)
    except (ValueError, base64.binascii.Error):
        pass
    return keys


_JWT_KEYS: list[str | bytes] = _candidate_keys(SUPABASE_JWT_SECRET)


async def get_current_user(
    token: str | None = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db),
) -> User:
    """Validate Supabase JWT and return the corresponding application User row.

    On first login the user and profile rows are auto-created (idempotent
    upsert). Raises 401 for missing/invalid/expired tokens and 403 for
    deactivated accounts.

    Audience verification is intentionally disabled: Supabase issues tokens
    with `aud="authenticated"` for end-users, but the value can differ across
    project versions and for service-role tokens. We instead trust HS256
    signature validation against the project's JWT secret plus an explicit
    `sub` (user id) check below.
    """
    credentials_error = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    if not token:
        raise credentials_error

    payload: dict | None = None
    last_error: Exception | None = None
    for key in _JWT_KEYS:
        try:
            payload = jwt.decode(
                token,
                key,
                algorithms=["HS256"],
                options={"verify_aud": False},
            )
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
        logger.warning("JWT validation failed with all candidate keys: %s", last_error)
        raise credentials_error

    supabase_sub: str | None = payload.get("sub")
    email: str = payload.get("email") or ""

    if not supabase_sub:
        logger.warning("JWT missing 'sub' claim")
        raise credentials_error

    metadata: dict = payload.get("user_metadata") or {}
    display_name: str = (
        metadata.get("full_name")
        or metadata.get("name")
        or (email.split("@")[0] if email else supabase_sub[:8])
    )

    user = await sync_user(
        supabase_sub=supabase_sub,
        email=email,
        name=display_name,
        db=db,
    )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account deactivated",
        )

    return user
