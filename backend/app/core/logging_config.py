"""
NRL Adaptive Learning System — Structured Logging

Two modes:
  - Pretty mode (default): human-readable colored-ish lines for dev.
  - JSON mode  (LOG_JSON=true): one-line JSON per record for Loki / cloud logs.

Configured once at import via setup_logging().
"""

from __future__ import annotations

import json
import logging
import os
import sys
from datetime import datetime, timezone

from app.core.config import LOG_LEVEL

LOG_JSON: bool = os.getenv("LOG_JSON", "false").lower() == "true"


class JsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        payload = {
            "ts": datetime.now(timezone.utc).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
        }
        if record.exc_info:
            payload["exc"] = self.formatException(record.exc_info)
        # Include extras (anything not standard)
        for key, value in record.__dict__.items():
            if key in {
                "name", "msg", "args", "levelname", "levelno", "pathname",
                "filename", "module", "exc_info", "exc_text", "stack_info",
                "lineno", "funcName", "created", "msecs", "relativeCreated",
                "thread", "threadName", "processName", "process", "message",
                "taskName",
            }:
                continue
            try:
                json.dumps(value)
                payload[key] = value
            except (TypeError, ValueError):
                payload[key] = repr(value)
        return json.dumps(payload, default=str)


def setup_logging() -> None:
    """Configure root logger. Idempotent."""
    root = logging.getLogger()
    root.setLevel(LOG_LEVEL)

    # Remove pre-existing handlers (uvicorn's, pytest's, etc.)
    for h in list(root.handlers):
        root.removeHandler(h)

    handler = logging.StreamHandler(sys.stdout)
    if LOG_JSON:
        handler.setFormatter(JsonFormatter())
    else:
        handler.setFormatter(
            logging.Formatter(
                fmt="%(asctime)s | %(levelname)-7s | %(name)-25s | %(message)s",
                datefmt="%H:%M:%S",
            )
        )
    root.addHandler(handler)

    # Quiet down very noisy libraries
    logging.getLogger("httpx").setLevel(logging.WARNING)
    logging.getLogger("httpcore").setLevel(logging.WARNING)
    logging.getLogger("sqlalchemy.engine").setLevel(logging.WARNING)
