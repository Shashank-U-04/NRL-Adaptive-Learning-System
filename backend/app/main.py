"""
NRL Adaptive Learning System — FastAPI Application Entry Point

Start: uvicorn backend.app.main:app --reload
"""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.app.core.config import APP_NAME, APP_VERSION, CORS_ORIGINS, DEBUG
from backend.app.core.database import init_db, engine

# ── Logging ──────────────────────────────────────────────
logging.basicConfig(
    level=logging.DEBUG if DEBUG else logging.INFO,
    format="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger("nrl")


# ── Lifespan ─────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info(f"Starting {APP_NAME} v{APP_VERSION}")
    await init_db()
    logger.info("PostgreSQL tables verified.")

    # Pre-warm RL engine singleton
    from backend.app.services.rl_service import get_rl_service
    get_rl_service()
    logger.info("RL service initialised.")

    yield

    logger.info("Shutting down — disposing DB engine.")
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

# ── Routers ──────────────────────────────────────────────
API_PREFIX = "/api/v1"

from backend.app.api.routes import auth, sessions, analytics, leaderboard, learning  # noqa: E402

app.include_router(auth.router,        prefix=API_PREFIX)
app.include_router(sessions.router,    prefix=API_PREFIX)
app.include_router(analytics.router,   prefix=API_PREFIX)
app.include_router(leaderboard.router, prefix=API_PREFIX)
app.include_router(learning.router,    prefix=API_PREFIX)


# ── System endpoints ──────────────────────────────────────
@app.get("/health", tags=["System"])
async def health():
    return {"status": "healthy", "app": APP_NAME, "version": APP_VERSION}


@app.get("/", tags=["System"])
async def root():
    return {
        "message": f"Welcome to {APP_NAME}",
        "docs": "/docs",
        "health": "/health",
    }
