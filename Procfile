# Heroku-style process declaration. Used by buildpack-based hosts and
# some local process managers. Production hosts (Fly.io) use the
# `[processes]` block in backend/fly.toml instead.
#
# Run apply-migrations BEFORE serving traffic. `api` is launched from
# the backend/ working directory by the platform.
release: cd backend && alembic upgrade head
api: cd backend && python -m uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}
web: npm --prefix frontend run start
