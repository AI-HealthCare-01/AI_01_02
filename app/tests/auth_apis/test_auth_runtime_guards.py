from unittest.mock import AsyncMock, patch

import pytest
from redis.exceptions import RedisError

from app.core import config
from app.core.config import Env
from app.services.auth import is_jti_blacklisted


@pytest.mark.asyncio
async def test_is_jti_blacklisted_fails_open_in_local_when_redis_is_unavailable():
    mock_client = AsyncMock()
    mock_client.exists.side_effect = RedisError("redis unavailable")

    with patch("app.services.auth._get_redis_client", return_value=mock_client), patch.object(config, "ENV", Env.LOCAL):
        assert await is_jti_blacklisted("local-jti") is False


@pytest.mark.asyncio
async def test_is_jti_blacklisted_fails_closed_in_prod_when_redis_is_unavailable():
    mock_client = AsyncMock()
    mock_client.exists.side_effect = RedisError("redis unavailable")

    with patch("app.services.auth._get_redis_client", return_value=mock_client), patch.object(config, "ENV", Env.PROD):
        assert await is_jti_blacklisted("prod-jti") is True
