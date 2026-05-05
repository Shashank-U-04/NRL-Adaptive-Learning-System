"""
Test fixtures.

Tests run against an isolated in-memory SQLite database — they never touch
the production Neon DB. We swap models' Postgres-only types (JSONB) for
JSON via a lightweight monkey-patch at import time.
"""

from __future__ import annotations

import asyncio
import os
import sys
from pathlib import Path

# Force SQLite + disable rate limit/metrics for tests BEFORE app imports
os.environ.setdefault("DATABASE_URL", "sqlite+aiosqlite:///:memory:")
os.environ.setdefault("RATE_LIMIT_ENABLED", "false")
os.environ.setdefault("METRICS_ENABLED", "false")
os.environ.setdefault("AI_PROVIDER", "none")
os.environ.setdefault("OLLAMA_TIMEOUT_SECONDS", "2")  # fail-fast in tests
os.environ.setdefault("SECRET_KEY", "test-secret-key-32-characters-long-padding")
os.environ.setdefault("DEBUG", "true")

# Ensure repo root is on sys.path
ROOT = Path(__file__).resolve().parent.parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

# Patch JSONB → JSON before models are imported
from sqlalchemy.dialects import postgresql  # noqa: E402
from sqlalchemy import JSON as _SAJSON  # noqa: E402

postgresql.JSONB = _SAJSON  # type: ignore[attr-defined]

import pytest  # noqa: E402
import pytest_asyncio  # noqa: E402
from httpx import ASGITransport, AsyncClient  # noqa: E402

from backend.app.core.database import AsyncSessionLocal, engine, init_db  # noqa: E402


@pytest.fixture(scope="session")
def event_loop():
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


@pytest_asyncio.fixture(scope="session")
async def _db_setup():
    await init_db()
    yield
    await engine.dispose()


@pytest_asyncio.fixture
async def client(_db_setup):
    """HTTP client wired to the FastAPI app via ASGI transport."""
    from backend.app.main import app

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as c:
        yield c


@pytest_asyncio.fixture
async def db_session(_db_setup):
    async with AsyncSessionLocal() as session:
        yield session
        await session.rollback()
