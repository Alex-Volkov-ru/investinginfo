from __future__ import annotations
import json, time
from typing import Any, Optional, Awaitable, Callable

import redis.asyncio as redis
from fastapi import HTTPException

from app.backend.core.config import get_settings

_settings = get_settings()
_redis: Optional[redis.Redis] = None

# ---------- Redis client ----------
async def get_redis() -> redis.Redis:
    global _redis
    if _redis is None:
        _redis = redis.from_url(
            _settings.REDIS_URL,
            encoding="utf-8",
            decode_responses=True,
        )
    return _redis

async def close_redis() -> None:
    global _redis
    if _redis is not None:
        try:
            await _redis.aclose()
        finally:
            _redis = None

# ---------- cache helpers ----------
async def cache_get(key: str) -> Optional[Any]:
    try:
        r = await get_redis()
        raw = await r.get(key)
        return json.loads(raw) if raw else None
    except Exception:
        return None

async def cache_set(key: str, value: Any, ttl_sec: int) -> None:
    try:
        r = await get_redis()
        await r.setex(key, ttl_sec, json.dumps(value))
    except Exception:
        pass

async def cached_json(key: str, ttl_sec: int, loader: Callable[[], Awaitable[Any]]) -> Any:
    cached = await cache_get(key)
    if cached is not None:
        return cached
    data = await loader()
    await cache_set(key, data, ttl_sec)
    return data

# ---------- simple rate limit (fixed window) ----------
async def rate_limit(key: str, limit: int, window_sec: int) -> None:
    """
    Не более `limit` инкрементов за `window_sec`.
    Используем фиксированное окно: EXPIRE ставим только при первом INCR.
    """
    r = await get_redis()
    now_bucket = int(time.time()) // window_sec
    window_key = f"rl:{key}:{now_bucket}"
    try:
        count = await r.incr(window_key, 1)
        if count == 1:
            await r.expire(window_key, window_sec)
        if count > limit:
            raise HTTPException(status_code=429, detail="Too many requests, slow down")
    except HTTPException:
        raise
    except Exception:
        pass
