"""Alembic environment.

Loads DATABASE_URL from the project .env, registers the SQLAlchemy
metadata from app.models so future ``--autogenerate`` runs work, and
runs migrations using a sync engine. The application itself uses
asyncpg at runtime — for one-shot migrations we strip ``+asyncpg`` and
use the default psycopg driver.
"""

from __future__ import annotations

import os
import sys
from logging.config import fileConfig
from pathlib import Path

from alembic import context
from sqlalchemy import engine_from_config, pool

# Make ``app.*`` importable when alembic is invoked from backend/.
BACKEND_DIR = Path(__file__).resolve().parent.parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

# Load .env from the repo root so DATABASE_URL etc. are visible.
try:
    from dotenv import load_dotenv

    load_dotenv(BACKEND_DIR.parent / ".env")
except ImportError:  # pragma: no cover - optional dependency
    pass

# Import models so Base.metadata is populated for autogenerate. We use the
# side-effect-free ``db_base`` module here so alembic doesn't accidentally
# initialise the async engine before the URL is rewritten.
from app.core.db_base import Base  # noqa: E402
from app.models import models  # noqa: F401, E402

config = context.config
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata


def _resolve_database_url() -> str:
    url = os.getenv("DATABASE_URL")
    if not url:
        raise RuntimeError(
            "DATABASE_URL is not set. Add it to your .env or environment "
            "before running alembic."
        )
    # asyncpg/aiosqlite drivers can't run sync migrations — swap to the
    # default sync driver for psycopg / sqlite3.
    return (
        url.replace("postgresql+asyncpg://", "postgresql://", 1)
        .replace("sqlite+aiosqlite://", "sqlite://", 1)
    )


def run_migrations_offline() -> None:
    """Generate SQL without a live DB connection."""
    context.configure(
        url=_resolve_database_url(),
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        compare_type=True,
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """Apply migrations against a live DB."""
    cfg_section = config.get_section(config.config_ini_section) or {}
    cfg_section["sqlalchemy.url"] = _resolve_database_url()

    connectable = engine_from_config(
        cfg_section,
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            compare_type=True,
        )
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
