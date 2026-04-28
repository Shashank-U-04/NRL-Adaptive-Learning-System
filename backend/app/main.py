"""
NRL 2.0 — FastAPI Application

Entry point: uvicorn backend.app.main:app --reload
"""

import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.app.core.config import APP_NAME, APP_VERSION, CORS_ORIGINS, DEBUG
from backend.app.core.database import init_db, engine
from backend.app.api.routes import auth, sessions, analytics, leaderboard

# ── Logging ──────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO if DEBUG else logging.WARNING,
    format="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger("nrl")


# ── Lifespan ─────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info(f"Starting {APP_NAME} v{APP_VERSION}")
    await init_db()
    logger.info("SQLite database initialized")

    # Pre-load RL engine
    from backend.app.services.rl_service import get_rl_service
    get_rl_service()

    yield

    logger.info("Shutting down...")
    await engine.dispose()


# ── App ──────────────────────────────────────────────────
app = FastAPI(
    title=APP_NAME,
    version=APP_VERSION,
    description="AI-Powered Adaptive Learning Platform using Reinforcement Learning",
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
app.include_router(auth.router, prefix=API_PREFIX)
app.include_router(sessions.router, prefix=API_PREFIX)
app.include_router(analytics.router, prefix=API_PREFIX)
app.include_router(leaderboard.router, prefix=API_PREFIX)


# ── Health ───────────────────────────────────────────────
@app.get("/health", tags=["System"])
async def health():
    return {"status": "healthy", "app": APP_NAME, "version": APP_VERSION}


@app.get("/", tags=["System"])
async def root():
    return {"message": f"Welcome to {APP_NAME}", "docs": "/docs", "health": "/health"}
