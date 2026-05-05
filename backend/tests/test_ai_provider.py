"""Tests for the AI provider abstraction (no real network calls)."""

import socket

import pytest

from app.core.config import OLLAMA_BASE_URL
from app.services.ai_provider import AIProvider, AIProviderError


def _ollama_reachable() -> bool:
    """Detect a live local Ollama so we can skip 'all providers fail' tests."""
    try:
        host = OLLAMA_BASE_URL.split("://", 1)[-1].split(":", 1)
        hostname = host[0]
        port = int(host[1].split("/", 1)[0]) if len(host) > 1 else 11434
        with socket.create_connection((hostname, port), timeout=0.5):
            return True
    except OSError:
        return False


def test_extract_json_simple():
    raw = '{"a": 1, "b": "x"}'
    out = AIProvider._extract_json(raw)
    assert out == {"a": 1, "b": "x"}


def test_extract_json_with_prose():
    raw = "Here you go:\n```json\n{\"k\": 42}\n```\n"
    out = AIProvider._extract_json(raw)
    assert out == {"k": 42}


def test_extract_json_empty_fails():
    with pytest.raises(ValueError):
        AIProvider._extract_json("")


def test_extract_json_no_braces_fails():
    with pytest.raises(ValueError):
        AIProvider._extract_json("nothing here")


@pytest.mark.asyncio
async def test_provider_order_default():
    provider = AIProvider()
    order = provider._provider_order()
    assert "ollama" in order


@pytest.mark.asyncio
async def test_generate_json_all_fail_raises(monkeypatch):
    """When all providers are unreachable, expect AIProviderError.

    We monkeypatch OLLAMA_BASE_URL on the imported module so the test does not
    race against a developer's live Ollama daemon coming up mid-suite.
    """
    from app.services import ai_provider as ap

    monkeypatch.setattr(ap, "OLLAMA_BASE_URL", "http://127.0.0.1:1")
    monkeypatch.setattr(ap, "OPENAI_API_KEY", "")
    monkeypatch.setattr(ap, "TOGETHER_API_KEY", "")

    provider = AIProvider()
    with pytest.raises(AIProviderError):
        await provider.generate_json("sys", "user")
