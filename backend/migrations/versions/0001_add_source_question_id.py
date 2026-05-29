"""Add QuestionAttempt.source_question_id

Adds a nullable ``source_question_id`` column to ``question_attempts`` so
attempts on static JSON dataset questions retain traceability without a
foreign key into the (empty-for-JSON) ``questions`` table.

This is the project's FIRST Alembic revision. It assumes the rest of the
schema already exists from earlier ``create_all()`` runs. If your
environment is brand-new and the rest of the tables do not exist yet,
run the app once with ``AUTO_CREATE_TABLES=true`` (or run ``init_db``
explicitly) to create the base schema, then ``alembic stamp head`` to
mark this revision applied without re-running the ALTER.

Revision ID: 0001_add_source_question_id
Revises:
Create Date: 2026-05-28
"""
from __future__ import annotations

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "0001_add_source_question_id"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _has_column(bind, table: str, column: str) -> bool:
    """Return True if ``table.column`` already exists.

    Lets the migration be re-run safely on a database that was
    bootstrapped via ``create_all()`` after the column was added to the
    model (the column will already exist in that case).
    """
    inspector = sa.inspect(bind)
    if table not in inspector.get_table_names():
        return False
    return any(c["name"] == column for c in inspector.get_columns(table))


def upgrade() -> None:
    bind = op.get_bind()
    if not _has_column(bind, "question_attempts", "source_question_id"):
        op.add_column(
            "question_attempts",
            sa.Column("source_question_id", sa.String(length=80), nullable=True),
        )


def downgrade() -> None:
    bind = op.get_bind()
    if _has_column(bind, "question_attempts", "source_question_id"):
        op.drop_column("question_attempts", "source_question_id")
