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

    Supabase has two key formats in circulation:

    Old format (pre-2025):
      The JWT secret displayed in the dashboard is a base64-encoded string
      (typically ending in ==). We try both the raw string and the decoded bytes.

    New format (sb_secret_ prefix, 2025+):
      Supabase's new key management system prefixes secret keys with
      'sb_secret_'. The signing material is the URL-safe base64 payload
      after the prefix. We try:
        1. The full string as-is.
        2. The payload (after the prefix) as-is.
        3. The payload URL-safe base64-decoded to raw bytes.
        4. Standard base64 fallbacks for any remaining format.
    """
    keys: list[str | bytes] = [secret]

    if secret.startswith("sb_secret_"):
        payload = secret[len("sb_secret_"):]
        # Try the raw payload string
        if payload not in keys:
            keys.append(payload)
        # Try URL-safe base64 decode of the payload
        try:
            # Add padding if needed (base64url strings may omit trailing =)
            padding = (4 - len(payload) % 4) % 4
            decoded = base64.urlsafe_b64decode(payload + "=" * padding)
            if decoded and decoded not in [k if isinstance(k, bytes) else k.encode() for k in keys]:
                keys.append(decoded)
        except (ValueError, Exception):
            pass

    # Standard base64 decode — handles old Supabase secrets ending in ==
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

    Audience verification by PyJWT is disabled because Supabase has shipped
    multiple ``aud`` shapes (string vs list, ``"authenticated"`` vs project
    URL). We perform an explicit, narrow check below instead:

      * ``sub`` (user id) must be present.
      * The token must represent an end-user — either ``role == "authenticated"``
        or ``aud`` contains ``"authenticated"``. This rejects ``service_role``
        and ``anon`` keys that share the same signing secret.
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

    role = payload.get("role")
    aud = payload.get("aud")
    aud_list: list[str] = (
        [aud] if isinstance(aud, str) else list(aud) if isinstance(aud, (list, tuple)) else []
    )
    is_end_user = role == "authenticated" or "authenticated" in aud_list
    if not is_end_user:
        logger.warning(
            "Rejected non-user JWT (role=%r, aud=%r) for sub=%s",
            role, aud, supabase_sub,
        )
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
