"""
NRL Adaptive Learning System — Prometheus Metrics

Exposes a /metrics endpoint compatible with Prometheus scrape config.
Metrics are no-ops if METRICS_ENABLED=false.

Counters / histograms tracked:
  - http_requests_total{method, path, status}
  - http_request_duration_seconds{method, path}
  - ai_calls_total{provider, status}
  - active_sessions (gauge)
  - quiz_questions_answered_total{correct}
"""

from __future__ import annotations

import logging
import time

from fastapi import FastAPI, Request, Response
from prometheus_client import (
    CONTENT_TYPE_LATEST,
    CollectorRegistry,
    Counter,
    Gauge,
    Histogram,
    generate_latest,
)

from backend.app.core.config import METRICS_ENABLED

logger = logging.getLogger("nrl.metrics")

# Use a dedicated registry so we don't clash with default global one (handy for tests)
registry = CollectorRegistry()

http_requests_total = Counter(
    "http_requests_total",
    "Total HTTP requests",
    ["method", "path", "status"],
    registry=registry,
)
http_request_duration = Histogram(
    "http_request_duration_seconds",
    "HTTP request duration in seconds",
    ["method", "path"],
    registry=registry,
)
ai_calls_total = Counter(
    "ai_calls_total",
    "AI provider calls",
    ["provider", "status"],
    registry=registry,
)
active_sessions = Gauge(
    "active_sessions",
    "Active learning sessions in process cache",
    registry=registry,
)
quiz_questions_answered_total = Counter(
    "quiz_questions_answered_total",
    "Quiz questions answered",
    ["correct"],
    registry=registry,
)


def _normalize_path(path: str) -> str:
    """Collapse path params (UUIDs / IDs) so we don't blow up cardinality."""
    parts = path.split("/")
    cleaned: list[str] = []
    for part in parts:
        if not part:
            cleaned.append(part)
            continue
        # UUIDs
        if len(part) >= 32 and ("-" in part or part.isalnum()):
            cleaned.append(":id")
        # Numeric ids
        elif part.isdigit():
            cleaned.append(":id")
        else:
            cleaned.append(part)
    return "/".join(cleaned)


def setup_metrics(app: FastAPI) -> None:
    """Add HTTP middleware + /metrics endpoint."""
    if not METRICS_ENABLED:
        logger.info("Metrics disabled via METRICS_ENABLED=false")
        return

    @app.middleware("http")
    async def _track_request(request: Request, call_next):
        start = time.monotonic()
        path = _normalize_path(request.url.path)
        try:
            response = await call_next(request)
            status_code = response.status_code
        except Exception:
            http_requests_total.labels(request.method, path, "500").inc()
            http_request_duration.labels(request.method, path).observe(time.monotonic() - start)
            raise
        http_requests_total.labels(request.method, path, str(status_code)).inc()
        http_request_duration.labels(request.method, path).observe(time.monotonic() - start)
        return response

    @app.get("/metrics", tags=["System"], include_in_schema=False)
    async def metrics_endpoint() -> Response:
        return Response(generate_latest(registry), media_type=CONTENT_TYPE_LATEST)

    logger.info("Prometheus metrics enabled at /metrics")
