"""Rate limit fail-closed behavior."""

import pytest
from fastapi import HTTPException
from unittest.mock import AsyncMock, patch

from app.backend.core.cache import rate_limit


@pytest.mark.asyncio
async def test_rate_limit_fail_closed_when_redis_unavailable():
    with patch("app.backend.core.cache.get_redis", side_effect=ConnectionError("down")):
        with pytest.raises(HTTPException) as exc:
            await rate_limit("test-key", limit=5, window_sec=60, fail_closed=True)
        assert exc.value.status_code == 503


@pytest.mark.asyncio
async def test_rate_limit_fail_open_when_redis_unavailable():
    with patch("app.backend.core.cache.get_redis", side_effect=ConnectionError("down")):
        await rate_limit("test-key", limit=5, window_sec=60, fail_closed=False)


@pytest.mark.asyncio
async def test_rate_limit_exceeded():
    mock_redis = AsyncMock()
    mock_redis.incr = AsyncMock(return_value=6)
    mock_redis.expire = AsyncMock()
    with patch("app.backend.core.cache.get_redis", return_value=mock_redis):
        with pytest.raises(HTTPException) as exc:
            await rate_limit("login:1.2.3.4", limit=5, window_sec=60)
        assert exc.value.status_code == 429
