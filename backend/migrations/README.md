# Database migrations (Alembic)

Production schema changes go through Alembic. Local/dev can still rely on
SQLAlchemy `create_all()` (see `AUTO_CREATE_TABLES` in `app/main.py`),
but production must apply migrations explicitly before each deploy.

## Quick reference

All commands are run from the `backend/` directory with `DATABASE_URL`
set in your environment (or in the repo-root `.env`).

```bash
# Apply all pending migrations
alembic upgrade head

# Show the current applied revision
alembic current

# Generate SQL without applying (useful for review)
alembic upgrade head --sql

# Roll back the most recent revision (use with care)
alembic downgrade -1
```

## First-time setup

### Brand-new database

```bash
# 1. Create all tables (one-time bootstrap)
AUTO_CREATE_TABLES=true python -c "import asyncio; from app.core.database import init_db; asyncio.run(init_db())"

# 2. Mark the schema as up-to-date so alembic doesn't try to re-add columns
alembic stamp head
```

### Existing database (already created via `create_all()`)

Use this path on environments that have run the app before Alembic was
introduced.

```bash
# Apply only the changes that aren't already in place. Migration 0001
# uses a column-presence check, so it's safe to run on a DB whose models
# have already been create_all'd with the new column.
alembic upgrade head
```

The first migration adds `question_attempts.source_question_id` and is
idempotent — it inspects the table first and skips the `ALTER` when the
column already exists.

## Plain-SQL alternative

If you can't (or don't want to) install Alembic in production, the same
change can be applied directly with `psql`:

```sql
-- 001_add_source_question_id.sql
ALTER TABLE question_attempts
  ADD COLUMN IF NOT EXISTS source_question_id VARCHAR(80);
```

A copy lives at `backend/migrations/sql/001_add_source_question_id.sql`.

## Authoring new migrations

```bash
# Autogenerate from model changes (review the diff carefully)
alembic revision --autogenerate -m "add foo to bar"

# Empty migration template
alembic revision -m "data backfill"
```

Keep migrations idempotent where possible (`IF NOT EXISTS`, presence
checks, etc.) so re-runs and rollbacks don't break a partially-migrated
environment.
