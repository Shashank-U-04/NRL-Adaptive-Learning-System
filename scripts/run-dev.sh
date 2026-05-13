#!/usr/bin/env bash
# NRL - runs backend + frontend together. Uses foreman if available, else
# falls back to a hand-rolled pair of background processes with cleanup.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

# Activate venv if present
if [ -d ".venv" ]; then
  # shellcheck disable=SC1091
  source .venv/bin/activate
fi

# Prefer foreman / honcho when available
if command -v foreman >/dev/null 2>&1; then
  exec foreman start
fi
if command -v honcho >/dev/null 2>&1; then
  exec honcho start
fi

echo "[run-dev] foreman/honcho not found - running both processes manually."
echo "[run-dev] backend -> http://localhost:8000   frontend -> http://localhost:3000"

cleanup() {
  echo
  echo "[run-dev] stopping..."
  jobs -p | xargs -r kill 2>/dev/null || true
}
trap cleanup EXIT INT TERM

( cd "$ROOT_DIR/backend" && python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000 ) &
( cd "$ROOT_DIR/frontend" && npm run dev ) &

wait
