"""
NRL 2.0 — Application Configuration

All settings loaded from environment variables / .env file.
SQLite database, no Redis, no Docker.
"""

import os
from pathlib import Path
from dotenv import load_dotenv

# Load .env from project root
ROOT_DIR = Path(__file__).resolve().parent.parent.parent.parent  # backend/app/core/ → NRL/
load_dotenv(ROOT_DIR / ".env")

# ── App ──────────────────────────────────────────────────
APP_NAME = os.getenv("APP_NAME", "NRL 2.0")
APP_VERSION = "1.0.0"
DEBUG = os.getenv("DEBUG", "true").lower() == "true"

# ── Database (SQLite) ───────────────────────────────────
DATABASE_PATH = ROOT_DIR / "backend" / "database.db"
DATABASE_URL = f"sqlite+aiosqlite:///{DATABASE_PATH}"

# ── JWT Auth ─────────────────────────────────────────────
SECRET_KEY = os.getenv("SECRET_KEY", "nrl-dev-secret-change-in-production")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "30"))
REFRESH_TOKEN_EXPIRE_DAYS = int(os.getenv("REFRESH_TOKEN_EXPIRE_DAYS", "7"))

# ── CORS ─────────────────────────────────────────────────
CORS_ORIGINS = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]

# ── RL Engine ────────────────────────────────────────────
RL_MODEL_PATH = str(ROOT_DIR / "backend" / "app" / "ml" / "models" / "trained_agent.pkl")
RL_EXPLORATION_RATE = float(os.getenv("RL_EXPLORATION_RATE", "0.05"))

# ── Session TTL ──────────────────────────────────────────
SESSION_TTL_SECONDS = 3600  # 1 hour
