"""
NRL Adaptive Learning System — Async PostgreSQL Database Engine

Uses SQLAlchemy 2.x with asyncpg driver and connection pooling.
"""

import logging
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import declarative_base

from backend.app.core.config import DATABASE_URL

logger = logging.getLogger("nrl.database")

# ── Engine with connection pooling ────────────────────────
engine = create_async_engine(
    DATABASE_URL,
    echo=False,           # Set True to log all SQL (debug only)
    pool_size=10,
    max_overflow=20,
    pool_pre_ping=True,   # Detect stale connections
    pool_recycle=3600,    # Recycle connections every hour
)

# ── Session factory ───────────────────────────────────────
AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)

Base = declarative_base()


# ── Dependency ────────────────────────────────────────────
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


# ── Table creation ────────────────────────────────────────
async def init_db() -> None:
    """Create all tables if they don't already exist."""
    from backend.app.models.models import Base as ModelsBase  # noqa: F401 — registers metadata
    async with engine.begin() as conn:
        await conn.run_sync(ModelsBase.metadata.create_all)
    logger.info("Database tables verified/created successfully.")
