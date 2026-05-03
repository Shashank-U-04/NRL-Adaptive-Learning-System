"""
NRL Adaptive Learning System — Application Configuration

All settings loaded from environment variables / .env file.
PostgreSQL database with Redis caching.
"""

import os
from pathlib import Path
from dotenv import load_dotenv

# Load .env from project root  (backend/app/core/ → root is 4 levels up)
ROOT_DIR = Path(__file__).resolve().parent.parent.parent.parent
load_dotenv(ROOT_DIR / ".env")

# ── App ──────────────────────────────────────────────────
APP_NAME = os.getenv("APP_NAME", "NRL Adaptive Learning System")
APP_VERSION = "2.0.0"
DEBUG = os.getenv("DEBUG", "true").lower() == "true"

# ── Database (PostgreSQL) ───────────────────────────────
DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql+asyncpg://postgres:password@localhost:5432/nrl_db",
)

# ── Redis ────────────────────────────────────────────────
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")

# ── OpenAI / AI ──────────────────────────────────────────
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-4o-mini")
OPENAI_BASE_URL = os.getenv("OPENAI_BASE_URL", None)

# ── JWT Auth ─────────────────────────────────────────────
SECRET_KEY = os.getenv("SECRET_KEY", "nrl-dev-secret-change-in-production-min-32-chars")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "30"))
REFRESH_TOKEN_EXPIRE_DAYS = int(os.getenv("REFRESH_TOKEN_EXPIRE_DAYS", "7"))

# ── CORS ─────────────────────────────────────────────────
_cors_raw = os.getenv("CORS_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000")
CORS_ORIGINS = [o.strip() for o in _cors_raw.split(",") if o.strip()]

# ── RL Engine ────────────────────────────────────────────
RL_MODEL_PATH = ROOT_DIR / "backend" / "app" / "ml" / "models" / "dqn_agent.pt"
RL_EXPLORATION_RATE = float(os.getenv("RL_EXPLORATION_RATE", "0.05"))

# ── Session TTL ──────────────────────────────────────────
SESSION_TTL_SECONDS = 3600  # 1 hour
