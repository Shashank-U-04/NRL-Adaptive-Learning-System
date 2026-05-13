"""
NRL Adaptive Learning System — Application Configuration

All settings loaded from environment variables / .env file.
Supabase handles authentication; SUPABASE_JWT_SECRET is required at startup.
"""

import os
from pathlib import Path
from dotenv import load_dotenv

# Load .env from project root  (backend/app/core/ → root is 4 levels up)
ROOT_DIR = Path(__file__).resolve().parent.parent.parent.parent
load_dotenv(ROOT_DIR / ".env")

# ── App ──────────────────────────────────────────────────
APP_NAME = os.getenv("APP_NAME", "NRL Adaptive Learning System")
APP_VERSION = "2.1.0"
DEBUG = os.getenv("DEBUG", "true").lower() == "true"
ENVIRONMENT = os.getenv("ENVIRONMENT", "development")

# ── Database (PostgreSQL via Neon, or local) ─────────────
DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql+asyncpg://postgres:password@localhost:5432/nrl_db",
)

# Normalize: Neon dashboard often shows `postgresql://` — convert to async driver
if DATABASE_URL.startswith("postgresql://") and "+asyncpg" not in DATABASE_URL:
    DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+asyncpg://", 1)

# ── Supabase Auth ─────────────────────────────────────────
SUPABASE_JWT_SECRET: str = os.getenv("SUPABASE_JWT_SECRET", "")
SUPABASE_URL: str = os.getenv("SUPABASE_URL", "")

if not SUPABASE_JWT_SECRET:
    raise ValueError(
        "SUPABASE_JWT_SECRET is required but was not set. "
        "Add it to your .env file or environment before starting the server."
    )

# ── JWT Auth (legacy / internal tokens) ──────────────────
SECRET_KEY = os.getenv("SECRET_KEY", "nrl-dev-secret-change-in-production-min-32-chars")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "30"))

# ── CORS ─────────────────────────────────────────────────
_cors_raw = os.getenv("CORS_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000")
CORS_ORIGINS = [o.strip() for o in _cors_raw.split(",") if o.strip()]

# ── RL Engine ────────────────────────────────────────────
RL_MODEL_PATH = ROOT_DIR / "backend" / "app" / "ml" / "models" / "dqn_agent.pt"
RL_EXPLORATION_RATE = float(os.getenv("RL_EXPLORATION_RATE", "0.05"))

# ── Session TTL ──────────────────────────────────────────
SESSION_TTL_SECONDS = int(os.getenv("SESSION_TTL_SECONDS", "3600"))  # 1 hour

# ── Observability ────────────────────────────────────────
LOG_LEVEL = os.getenv("LOG_LEVEL", "DEBUG" if DEBUG else "INFO").upper()
