#!/usr/bin/env bash
# NRL — One-shot dev setup. Idempotent; safe to re-run.
set -euo pipefail

echo "================================================="
echo " NRL Adaptive Learning — local dev setup"
echo "================================================="

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

# Python venv
if [ ! -d ".venv" ]; then
  echo "[setup] creating Python virtualenv at .venv"
  python3 -m venv .venv
fi
# shellcheck disable=SC1091
source .venv/bin/activate

echo "[setup] installing backend deps"
pip install -q --upgrade pip
pip install -q -r backend/requirements.txt

echo "[setup] installing frontend deps"
( cd frontend && npm install --silent )

if [ ! -f ".env" ]; then
  echo "[setup] creating .env from .env.example"
  cp .env.example .env
  echo
  echo " ⚠️  .env created with defaults. Edit it before running:"
  echo "     - DATABASE_URL  (Neon connection string)"
  echo "     - SECRET_KEY    (long random value for prod)"
  echo
fi

echo
echo "✅ Setup complete."
echo
echo "Next:"
echo "  1. Start Ollama in a separate terminal:   ollama serve"
echo "  2. Activate the venv:                     source .venv/bin/activate"
echo "  3. Seed the database (one time):          ( cd backend && python seed.py )"
echo "  4. Run frontend + backend together:       ./scripts/run-dev.sh"
