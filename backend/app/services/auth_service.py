"""
NRL Adaptive Learning System — Auth Service

Provides sync_user: an idempotent upsert that ensures a users row and its
associated profiles row exist for a given Supabase identity. Called by the
auth dependency on every authenticated request so the application DB stays
in sync with Supabase without any separate registration step.
"""

import logging
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.models import User, Profile

logger = logging.getLogger(__name__)


async def sync_user(
    supabase_sub: str,
    email: str,
    name: str,
    db: AsyncSession,
) -> User:
    """Idempotent upsert — called from dependencies.py on first login.

    If a users row with id == supabase_sub already exists it is returned
    directly. Otherwise a new users row and a default profiles row are
    created and flushed so the caller receives a fully-populated User object.

    Args:
        supabase_sub: The ``sub`` claim from the Supabase JWT (user UUID).
        email: The ``email`` claim from the Supabase JWT.
        name: Display name hint (may be empty; falls back to email prefix).
        db: Active async database session.

    Returns:
        The application User ORM object (may be newly created).
    """
    result = await db.execute(select(User).where(User.id == supabase_sub))
    user: User | None = result.scalar_one_or_none()

    if user is not None:
        return user

    display_name = name.strip() if name.strip() else email.split("@")[0]

    user = User(
        id=supabase_sub,
        name=display_name,
        email=email,
    )
    db.add(user)
    await db.flush()

    profile = Profile(user_id=user.id)
    db.add(profile)
    await db.flush()

    logger.info("Auto-created application user for Supabase sub=%s email=%s", supabase_sub, email)
    return user
