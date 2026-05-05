"""
NRL Adaptive Learning System — Application Configuration

All settings loaded from environment variables / .env file.
Defaults work for local dev (SQLite + Ollama). Overrides for prod.
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

# ── Redis (OPTIONAL — falls back to in-memory) ────────────
REDIS_URL = os.getenv("REDIS_URL", "")  # empty = use in-memory
USE_REDIS = bool(REDIS_URL)

# ── AI Provider Configuration ─────────────────────────────
# Priority order: Ollama (local, free) → OpenAI/OpenRouter (paid) → static fallback
AI_PROVIDER = os.getenv("AI_PROVIDER", "ollama").lower()  # ollama | openai | none

# Ollama (free, local LLM)
OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "mistral")
OLLAMA_TIMEOUT_SECONDS = int(os.getenv("OLLAMA_TIMEOUT_SECONDS", "120"))

# OpenAI / OpenRouter (paid fallback)
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-4o-mini")
OPENAI_BASE_URL = os.getenv("OPENAI_BASE_URL", None)  # set for OpenRouter etc.

# Together.ai (free tier alternative)
TOGETHER_API_KEY = os.getenv("TOGETHER_API_KEY", "")
TOGETHER_MODEL = os.getenv("TOGETHER_MODEL", "mistralai/Mistral-7B-Instruct-v0.1")

# Cost tracking
AI_MONTHLY_BUDGET_USD = float(os.getenv("AI_MONTHLY_BUDGET_USD", "10.0"))

# AI module cache expiry (0 = never expire). Stale modules are deactivated and
# regenerated on the next request so content can be refreshed without manual ops.
CACHE_EXPIRY_DAYS = int(os.getenv("CACHE_EXPIRY_DAYS", "0"))

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
SESSION_TTL_SECONDS = int(os.getenv("SESSION_TTL_SECONDS", "3600"))  # 1 hour

# ── Rate Limiting ────────────────────────────────────────
RATE_LIMIT_ENABLED = os.getenv("RATE_LIMIT_ENABLED", "true").lower() == "true"
RATE_LIMIT_DEFAULT = os.getenv("RATE_LIMIT_DEFAULT", "60/minute")
RATE_LIMIT_AUTH = os.getenv("RATE_LIMIT_AUTH", "10/minute")

# ── Observability ────────────────────────────────────────
METRICS_ENABLED = os.getenv("METRICS_ENABLED", "true").lower() == "true"
LOG_LEVEL = os.getenv("LOG_LEVEL", "DEBUG" if DEBUG else "INFO").upper()
LOG_JSON = os.getenv("LOG_JSON", "false").lower() == "true"
