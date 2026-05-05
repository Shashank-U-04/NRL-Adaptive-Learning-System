"""
NRL Adaptive Learning System — FastAPI Application Entry Point

Start: uvicorn backend.app.main:app --reload
"""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.app.core.config import (
    APP_NAME,
    APP_VERSION,
    CORS_ORIGINS,
    ENVIRONMENT,
)
from backend.app.core.cost_tracker import cost_tracker
from backend.app.core.database import engine, init_db
from backend.app.core.logging_config import setup_logging
from backend.app.core.metrics import setup_metrics
from backend.app.core.rate_limit import setup_rate_limiting

setup_logging()
logger = logging.getLogger("nrl")


# ── Lifespan ─────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info(f"Starting {APP_NAME} v{APP_VERSION} (env={ENVIRONMENT})")
    await init_db()
    logger.info("Database tables verified.")

    # Pre-warm RL engine
    from backend.app.services.rl_service import get_rl_service

    get_rl_service()
    logger.info("RL service initialised.")

    # Pre-warm AI provider (best-effort, non-fatal)
    try:
        from backend.app.services.ai_provider import get_ai_provider

        provider = await get_ai_provider()
        health = await provider.health()
        logger.info(f"AI provider ready: preferred={health['preferred']}")
    except Exception as exc:  # noqa: BLE001
        logger.warning(f"AI provider warm-up failed (non-fatal): {exc}")

    yield

    logger.info("Shutting down — closing DB engine and AI client.")
    try:
        from backend.app.services.ai_provider import get_ai_provider

        await (await get_ai_provider()).close()
    except Exception:  # noqa: BLE001
        pass
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
    allow_methods=["*"],
    allow_headers=["*"],
)

setup_rate_limiting(app)
setup_metrics(app)


# ── Routers ──────────────────────────────────────────────
API_PREFIX = "/api/v1"

from backend.app.api.routes import (  # noqa: E402
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


@app.get("/system/ai", tags=["System"])
async def ai_health():
    """Show which AI providers are available and which is preferred."""
    from backend.app.services.ai_provider import get_ai_provider

    provider = await get_ai_provider()
    return await provider.health()


@app.get("/system/cost", tags=["System"])
async def ai_cost_report():
    """Return monthly AI usage and remaining budget."""
    return await cost_tracker.report()
