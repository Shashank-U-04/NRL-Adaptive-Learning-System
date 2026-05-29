"""Add Session.consecutive_correct

Persists the live streak counter on the session row so the user-visible
flame survives a session-cache miss (multi-worker, restart, eviction).

Revision ID: 0002_add_session_consecutive_correct
Revises: 0001_add_source_question_id
Create Date: 2026-05-28
"""
from __future__ import annotations

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "0002_add_session_consecutive_correct"
down_revision: Union[str, None] = "0001_add_source_question_id"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _has_column(bind, table: str, column: str) -> bool:
    inspector = sa.inspect(bind)
    if table not in inspector.get_table_names():
        return False
    return any(c["name"] == column for c in inspector.get_columns(table))


def upgrade() -> None:
    bind = op.get_bind()
    if not _has_column(bind, "sessions", "consecutive_correct"):
        op.add_column(
            "sessions",
            sa.Column(
                "consecutive_correct",
                sa.Integer(),
                nullable=False,
                server_default="0",
            ),
        )
        # Drop the server_default so future Python-side defaults take over.
        op.alter_column("sessions", "consecutive_correct", server_default=None)


def downgrade() -> None:
    bind = op.get_bind()
    if _has_column(bind, "sessions", "consecutive_correct"):
        op.drop_column("sessions", "consecutive_correct")
