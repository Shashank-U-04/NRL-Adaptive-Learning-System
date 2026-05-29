"""
NRL Adaptive Learning System — Async Database Engine

Supports PostgreSQL (asyncpg) for prod and SQLite (aiosqlite) for tests/dev.
Pool tuning is applied only for non-SQLite drivers.
"""

from __future__ import annotations

import logging

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.config import DATABASE_URL
from app.core.db_base import Base  # re-exported for backwards compatibility

logger = logging.getLogger("nrl.database")

_is_sqlite = DATABASE_URL.startswith("sqlite")

_engine_kwargs: dict = {"echo": False}
if not _is_sqlite:
    _engine_kwargs.update(
        pool_size=10,
        max_overflow=20,
        pool_pre_ping=True,
        pool_recycle=3600,
    )

engine = create_async_engine(DATABASE_URL, **_engine_kwargs)

AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)

# Backwards-compat alias for any code that imported the old name
async_session_factory = AsyncSessionLocal

__all__ = [
    "engine",
    "AsyncSessionLocal",
    "async_session_factory",
    "Base",
    "get_db",
    "init_db",
]


async def get_db() -> AsyncSession:  # type: ignore[return]
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


async def init_db() -> None:
    """Create all tables if they don't already exist."""
    from app.models.models import Base as ModelsBase  # noqa: F401  (registers metadata)

    async with engine.begin() as conn:
        await conn.run_sync(ModelsBase.metadata.create_all)
    logger.info("Database tables verified/created.")
