"""
NRL Adaptive Learning System — Unified AI Provider

Provider hierarchy (auto-fallback):
  1. Ollama  (local, free) — primary
  2. OpenAI / OpenRouter / Together — paid fallback
  3. None — caller handles static fallback

Used by:
  - ai_generation_service (learning modules)
  - ai_question_service (quiz questions)
"""

from __future__ import annotations

import asyncio
import json
import logging
import time
from typing import Any

import httpx

from app.core.config import (
    AI_PROVIDER,
    OLLAMA_BASE_URL,
    OLLAMA_MODEL,
    OLLAMA_TIMEOUT_SECONDS,
    OPENAI_API_KEY,
    OPENAI_BASE_URL,
    OPENAI_MODEL,
    TOGETHER_API_KEY,
    TOGETHER_MODEL,
)
from app.core.cost_tracker import cost_tracker

logger = logging.getLogger("nrl.ai_provider")


class AIProviderError(RuntimeError):
    """Raised when no configured provider can satisfy the request."""


class AIProvider:
    """Unified AI client with automatic fallback chain."""

    def __init__(self) -> None:
        self.preferred = AI_PROVIDER
        self._http: httpx.AsyncClient | None = None

    async def _client(self) -> httpx.AsyncClient:
        if self._http is None or self._http.is_closed:
            self._http = httpx.AsyncClient(timeout=OLLAMA_TIMEOUT_SECONDS)
        return self._http

    # ── Public API ────────────────────────────────────────

    async def generate_json(
        self,
        system: str,
        user: str,
        *,
        temperature: float = 0.5,
        max_tokens: int = 2000,
    ) -> dict[str, Any]:
        """
        Generate a JSON response. Tries providers in order:
          1. Preferred (config.AI_PROVIDER)
          2. Ollama if available
          3. OpenAI/OpenRouter if API key set
          4. Together.ai if API key set
        Raises AIProviderError if all fail.
        """
        errors: list[str] = []
        order = self._provider_order()

        for provider in order:
            try:
                if provider == "ollama":
                    return await self._call_ollama(system, user, temperature, max_tokens)
                if provider == "openai":
                    return await self._call_openai(system, user, temperature, max_tokens)
                if provider == "together":
                    return await self._call_together(system, user, temperature, max_tokens)
            except Exception as exc:  # noqa: BLE001
                logger.warning(f"AI provider '{provider}' failed: {exc}")
                errors.append(f"{provider}: {exc}")

        raise AIProviderError(
            f"All AI providers failed. Tried {order}. Errors: {' | '.join(errors)}"
        )

    async def generate_text(
        self,
        prompt: str,
        *,
        temperature: float = 0.7,
        max_tokens: int = 1000,
    ) -> str:
        """Free-form text generation (non-JSON). Same fallback chain."""
        errors: list[str] = []
        for provider in self._provider_order():
            try:
                if provider == "ollama":
                    return await self._call_ollama_text(prompt, temperature, max_tokens)
                if provider == "openai":
                    out = await self._call_openai(
                        "You are a helpful assistant.", prompt, temperature, max_tokens, json_mode=False
                    )
                    return str(out.get("content", ""))
                if provider == "together":
                    out = await self._call_together(
                        "You are a helpful assistant.", prompt, temperature, max_tokens, json_mode=False
                    )
                    return str(out.get("content", ""))
            except Exception as exc:  # noqa: BLE001
                errors.append(f"{provider}: {exc}")
        raise AIProviderError(f"All providers failed: {' | '.join(errors)}")

    async def health(self) -> dict[str, Any]:
        """Best-effort liveness probe for each configured provider."""
        result: dict[str, Any] = {"preferred": self.preferred, "providers": {}}
        for provider in ("ollama", "openai", "together"):
            try:
                if provider == "ollama":
                    client = await self._client()
                    r = await client.get(f"{OLLAMA_BASE_URL}/api/tags", timeout=5)
                    result["providers"]["ollama"] = {
                        "available": r.status_code == 200,
                        "model": OLLAMA_MODEL,
                    }
                elif provider == "openai":
                    result["providers"]["openai"] = {
                        "available": bool(OPENAI_API_KEY),
                        "model": OPENAI_MODEL,
                    }
                elif provider == "together":
                    result["providers"]["together"] = {
                        "available": bool(TOGETHER_API_KEY),
                        "model": TOGETHER_MODEL,
                    }
            except Exception as exc:  # noqa: BLE001
                result["providers"][provider] = {"available": False, "error": str(exc)}
        return result

    async def close(self) -> None:
        if self._http and not self._http.is_closed:
            await self._http.aclose()

    # ── Provider selection ────────────────────────────────

    def _provider_order(self) -> list[str]:
        """Return providers to try, with preferred first."""
        candidates: list[str] = []
        if self.preferred == "ollama":
            candidates.append("ollama")
        if self.preferred == "openai" or OPENAI_API_KEY:
            candidates.append("openai")
        if self.preferred == "together" or TOGETHER_API_KEY:
            candidates.append("together")
        # Always try ollama as fallback if not already there
        if "ollama" not in candidates:
            candidates.append("ollama")
        # De-dup while preserving order
        seen: set[str] = set()
        return [p for p in candidates if not (p in seen or seen.add(p))]

    # ── Provider implementations ──────────────────────────

    async def _call_ollama(
        self, system: str, user: str, temperature: float, max_tokens: int
    ) -> dict[str, Any]:
        """Call local Ollama, expect JSON back."""
        client = await self._client()
        prompt = f"{system}\n\nUser request:\n{user}\n\nReply with valid JSON only."
        t0 = time.monotonic()
        r = await client.post(
            f"{OLLAMA_BASE_URL}/api/generate",
            json={
                "model": OLLAMA_MODEL,
                "prompt": prompt,
                "stream": False,
                "format": "json",
                "options": {
                    "temperature": temperature,
                    "num_predict": max_tokens,
                },
            },
            timeout=OLLAMA_TIMEOUT_SECONDS,
        )
        elapsed = time.monotonic() - t0
        if r.status_code != 200:
            raise RuntimeError(f"Ollama HTTP {r.status_code}: {r.text[:200]}")

        data = r.json()
        raw = (data.get("response") or "").strip()
        await cost_tracker.log("ollama", input_tokens=data.get("prompt_eval_count", 0),
                                output_tokens=data.get("eval_count", 0), cost_usd=0.0,
                                elapsed_seconds=elapsed)

        return self._extract_json(raw)

    async def _call_ollama_text(self, prompt: str, temperature: float, max_tokens: int) -> str:
        client = await self._client()
        t0 = time.monotonic()
        r = await client.post(
            f"{OLLAMA_BASE_URL}/api/generate",
            json={
                "model": OLLAMA_MODEL,
                "prompt": prompt,
                "stream": False,
                "options": {"temperature": temperature, "num_predict": max_tokens},
            },
            timeout=OLLAMA_TIMEOUT_SECONDS,
        )
        elapsed = time.monotonic() - t0
        if r.status_code != 200:
            raise RuntimeError(f"Ollama HTTP {r.status_code}")
        data = r.json()
        await cost_tracker.log("ollama", input_tokens=data.get("prompt_eval_count", 0),
                                output_tokens=data.get("eval_count", 0), cost_usd=0.0,
                                elapsed_seconds=elapsed)
        return data.get("response", "")

    async def _call_openai(
        self,
        system: str,
        user: str,
        temperature: float,
        max_tokens: int,
        *,
        json_mode: bool = True,
    ) -> dict[str, Any]:
        if not OPENAI_API_KEY:
            raise RuntimeError("OPENAI_API_KEY not set")
        client = await self._client()
        url = (OPENAI_BASE_URL or "https://api.openai.com/v1").rstrip("/") + "/chat/completions"
        body: dict[str, Any] = {
            "model": OPENAI_MODEL,
            "messages": [
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
            "temperature": temperature,
            "max_tokens": max_tokens,
        }
        if json_mode:
            body["response_format"] = {"type": "json_object"}

        t0 = time.monotonic()
        r = await client.post(
            url,
            json=body,
            headers={
                "Authorization": f"Bearer {OPENAI_API_KEY}",
                "Content-Type": "application/json",
            },
            timeout=60,
        )
        elapsed = time.monotonic() - t0
        if r.status_code != 200:
            raise RuntimeError(f"OpenAI HTTP {r.status_code}: {r.text[:200]}")
        data = r.json()
        usage = data.get("usage", {})
        # Approximate cost — gpt-4o-mini pricing (subject to change)
        in_t = usage.get("prompt_tokens", 0)
        out_t = usage.get("completion_tokens", 0)
        cost = (in_t * 0.15 + out_t * 0.6) / 1_000_000  # $0.15 / $0.60 per 1M tokens
        await cost_tracker.log("openai", input_tokens=in_t, output_tokens=out_t,
                                cost_usd=cost, elapsed_seconds=elapsed)

        content = data["choices"][0]["message"]["content"]
        if json_mode:
            return self._extract_json(content)
        return {"content": content}

    async def _call_together(
        self,
        system: str,
        user: str,
        temperature: float,
        max_tokens: int,
        *,
        json_mode: bool = True,
    ) -> dict[str, Any]:
        if not TOGETHER_API_KEY:
            raise RuntimeError("TOGETHER_API_KEY not set")
        client = await self._client()
        url = "https://api.together.xyz/v1/chat/completions"
        body = {
            "model": TOGETHER_MODEL,
            "messages": [
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
            "temperature": temperature,
            "max_tokens": max_tokens,
        }
        t0 = time.monotonic()
        r = await client.post(
            url,
            json=body,
            headers={
                "Authorization": f"Bearer {TOGETHER_API_KEY}",
                "Content-Type": "application/json",
            },
            timeout=60,
        )
        elapsed = time.monotonic() - t0
        if r.status_code != 200:
            raise RuntimeError(f"Together HTTP {r.status_code}: {r.text[:200]}")
        data = r.json()
        usage = data.get("usage", {})
        in_t = usage.get("prompt_tokens", 0)
        out_t = usage.get("completion_tokens", 0)
        cost = (in_t + out_t) * 0.0000002  # ~Mistral 7B free-tier rate
        await cost_tracker.log("together", input_tokens=in_t, output_tokens=out_t,
                                cost_usd=cost, elapsed_seconds=elapsed)
        content = data["choices"][0]["message"]["content"]
        if json_mode:
            return self._extract_json(content)
        return {"content": content}

    # ── Helpers ───────────────────────────────────────────

    @staticmethod
    def _extract_json(raw: str) -> dict[str, Any]:
        """Safely extract JSON from a model response."""
        if not raw:
            raise ValueError("Empty AI response")
        # Strip ``` fences if present
        stripped = raw.strip()
        if stripped.startswith("```"):
            stripped = stripped.strip("`")
            # Drop language hint line
            if "\n" in stripped:
                first, rest = stripped.split("\n", 1)
                if first.lower() in ("json", "javascript", "js"):
                    stripped = rest
        # Find first { ... } block
        start = stripped.find("{")
        end = stripped.rfind("}")
        if start == -1 or end == -1:
            raise ValueError(f"No JSON object found in response: {stripped[:200]}")
        return json.loads(stripped[start : end + 1])


# ── Singleton ─────────────────────────────────────────────

_provider: AIProvider | None = None
_provider_lock = asyncio.Lock()


async def get_ai_provider() -> AIProvider:
    global _provider
    if _provider is None:
        async with _provider_lock:
            if _provider is None:
                _provider = AIProvider()
    return _provider
