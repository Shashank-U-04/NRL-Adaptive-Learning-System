"""
NRL 2.0 — SQLite Database Engine

Async SQLAlchemy 2.0 with aiosqlite.
Creates database.db in the project root.
"""

from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy import event

from backend.app.core.config import DATABASE_URL


engine = create_async_engine(
    DATABASE_URL,
    echo=False,
    connect_args={"check_same_thread": False},
)

async_session_factory = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


class Base(DeclarativeBase):
    pass


async def get_db():
    """FastAPI dependency — yields an async DB session."""
    async with async_session_factory() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise


async def init_db():
    """Create all tables (run on startup)."""
    async with engine.begin() as conn:
        # Enable foreign keys for SQLite
        await conn.execute(
            __import__("sqlalchemy").text("PRAGMA foreign_keys = ON")
        )
        await conn.run_sync(Base.metadata.create_all)
