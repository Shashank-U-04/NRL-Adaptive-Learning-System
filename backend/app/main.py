"""
NRL Adaptive Learning System — FastAPI Application Entry Point

Start: uvicorn app.main:app --reload
"""

import logging
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import (
    APP_NAME,
    APP_VERSION,
    CORS_ORIGINS,
    ENVIRONMENT,
)
from app.core.database import engine, init_db
from app.core.logging_config import setup_logging

setup_logging()
logger = logging.getLogger("nrl")


def _should_auto_create_tables() -> bool:
    """Decide whether to run SQLAlchemy ``create_all()`` at startup.

    Production must opt in explicitly via ``AUTO_CREATE_TABLES=true`` because
    ``create_all`` does NOT handle schema changes — real environments should
    use Alembic or a migration tool. Development and test environments run
    it by default so the local DX stays one command.
    """
    explicit = os.getenv("AUTO_CREATE_TABLES")
    if explicit is not None:
        return explicit.strip().lower() in {"1", "true", "yes", "on"}
    return ENVIRONMENT.lower() not in {"production", "prod"}


# ── Lifespan ─────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info(f"Starting {APP_NAME} v{APP_VERSION} (env={ENVIRONMENT})")
    if _should_auto_create_tables():
        await init_db()
        logger.info("Database tables verified (create_all ran).")
    else:
        logger.info(
            "Skipping create_all in %s — set AUTO_CREATE_TABLES=true to override.",
            ENVIRONMENT,
        )

    # Pre-warm adaptive engine
    from app.adaptive.engine import get_adaptive_engine

    get_adaptive_engine()
    logger.info("Adaptive engine initialised.")

    yield

    logger.info("Shutting down — closing DB engine.")
    await engine.dispose()


# ── App ──────────────────────────────────────────────────
app = FastAPI(
    title=APP_NAME,
    version=APP_VERSION,
    description="AI-Powered Adaptive Cybersecurity Learning Platform",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "X-Request-ID"],
)

@app.middleware("http")
async def security_headers(request: Request, call_next) -> Response:
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"] = "geolocation=(), microphone=(), camera=()"
    if ENVIRONMENT == "production":
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    return response


# ── Routers ──────────────────────────────────────────────
API_PREFIX = "/api/v1"

from app.api.routes import (  # noqa: E402
    analytics,
    auth,
    leaderboard,
    learning,
    sessions,
)

app.include_router(auth.router, prefix=API_PREFIX)
app.include_router(sessions.router, prefix=API_PREFIX)
app.include_router(analytics.router, prefix=API_PREFIX)
app.include_router(leaderboard.router, prefix=API_PREFIX)
app.include_router(learning.router, prefix=API_PREFIX)


# ── System endpoints ──────────────────────────────────────
@app.get("/health", tags=["System"])
async def health():
    return {"status": "healthy", "app": APP_NAME, "version": APP_VERSION}


@app.get("/", tags=["System"])
async def root():
    return {
        "message": f"Welcome to {APP_NAME}",
        "version": APP_VERSION,
        "docs": "/docs",
        "health": "/health",
        "metrics": "/metrics",
    }


