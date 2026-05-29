"""Side-effect-free SQLAlchemy declarative base.

Kept separate from ``app.core.database`` so tools that only need the
metadata (Alembic env, schema dumps, doc generators) can import the
``Base`` without triggering async engine creation. Importing this module
performs no I/O.
"""

from __future__ import annotations

from sqlalchemy.orm import declarative_base

Base = declarative_base()

__all__ = ["Base"]
