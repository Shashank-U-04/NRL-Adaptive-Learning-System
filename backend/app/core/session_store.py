"""
NRL 2.0 — In-Memory Session Store

Replaces Redis for session state caching.
Thread-safe dict with TTL-based expiry.
"""

import asyncio
import time
from typing import Optional


class SessionStore:
    """In-memory key-value store with automatic TTL expiry."""

    def __init__(self):
        self._store: dict[str, tuple[dict, float]] = {}  # key -> (data, expiry_ts)
        self._lock = asyncio.Lock()

    async def set(self, key: str, data: dict, ttl: int = 3600) -> None:
        """Store data with a TTL in seconds."""
        async with self._lock:
            self._store[key] = (data, time.time() + ttl)

    async def get(self, key: str) -> Optional[dict]:
        """Get data if it exists and hasn't expired."""
        async with self._lock:
            if key in self._store:
                data, expiry = self._store[key]
                if time.time() < expiry:
                    return data
                del self._store[key]
            return None

    async def delete(self, key: str) -> None:
        """Remove a key."""
        async with self._lock:
            self._store.pop(key, None)

    async def cleanup(self) -> int:
        """Remove all expired entries. Returns count removed."""
        async with self._lock:
            now = time.time()
            expired = [k for k, (_, exp) in self._store.items() if now >= exp]
            for k in expired:
                del self._store[k]
            return len(expired)

    @property
    def size(self) -> int:
        return len(self._store)


# Singleton instance
session_store = SessionStore()
