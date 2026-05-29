"""Migration sanity tests.

These do not run alembic against the test DB (conftest still uses
``init_db`` / SQLAlchemy ``create_all`` for speed). They instead verify
that the migration source files are present, well-formed, and that the
schema column added by 0001 is in the live model.
"""

from __future__ import annotations

import importlib.util
from pathlib import Path

from app.models.models import QuestionAttempt


MIGRATIONS_DIR = Path(__file__).resolve().parent.parent / "migrations"


def test_alembic_config_exists() -> None:
    assert (Path(__file__).resolve().parent.parent / "alembic.ini").is_file()
    assert (MIGRATIONS_DIR / "env.py").is_file()
    assert (MIGRATIONS_DIR / "script.py.mako").is_file()


def test_first_revision_loads_cleanly() -> None:
    """The 0001 file must import without side-effects and declare a revision id."""
    rev = MIGRATIONS_DIR / "versions" / "0001_add_source_question_id.py"
    assert rev.is_file()

    spec = importlib.util.spec_from_file_location("nrl_mig_0001", rev)
    assert spec is not None and spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)

    assert getattr(module, "revision", None) == "0001_add_source_question_id"
    assert getattr(module, "down_revision", "missing") is None
    assert callable(getattr(module, "upgrade", None))
    assert callable(getattr(module, "downgrade", None))


def test_question_attempt_model_has_source_question_id() -> None:
    """Regression guard: model must keep the column the migration adds."""
    cols = {c.name for c in QuestionAttempt.__table__.columns}
    assert "source_question_id" in cols


def test_sql_migration_file_present() -> None:
    """Plain-SQL fallback for ops who don't run alembic."""
    sql = MIGRATIONS_DIR / "sql" / "001_add_source_question_id.sql"
    assert sql.is_file()
    text = sql.read_text(encoding="utf-8")
    assert "ADD COLUMN IF NOT EXISTS source_question_id" in text
