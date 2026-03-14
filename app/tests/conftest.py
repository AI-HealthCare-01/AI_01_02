import asyncio
import os
from collections.abc import Generator
from typing import Any
from unittest.mock import AsyncMock, Mock, patch

import pytest
import pytest_asyncio
from _pytest.fixtures import FixtureRequest
from tortoise import generate_config
from tortoise.contrib.test import finalizer, initializer

# CI 환경에서 필수 환경변수가 없을 경우 기본값 설정
os.environ.setdefault("SECRET_KEY", "test-secret-key-for-ci")

from app.db.databases import TORTOISE_APP_MODELS  # noqa: E402

TEST_BASE_URL = "http://test"
TEST_DB_LABEL = "models"
TEST_DB_TZ = "Asia/Seoul"
TEST_DB_URL = "sqlite://:memory:"


def get_test_db_config() -> dict[str, Any]:
    tortoise_config = generate_config(
        db_url=TEST_DB_URL,
        app_modules={TEST_DB_LABEL: TORTOISE_APP_MODELS},
        connection_label=TEST_DB_LABEL,
        testing=True,
    )
    tortoise_config["timezone"] = TEST_DB_TZ

    return tortoise_config


@pytest.fixture(scope="session", autouse=True)
def initialize(request: FixtureRequest) -> Generator[None]:
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    with patch("tortoise.contrib.test.getDBConfig", Mock(return_value=get_test_db_config())):
        initializer(modules=TORTOISE_APP_MODELS)
    yield
    finalizer()
    loop.close()


@pytest.fixture(scope="session", autouse=True)
def mock_redis_jti_check() -> Generator[None]:
    """Redis가 없는 테스트 환경에서 JTI 블랙리스트 관련 함수를 mock."""
    mock_is_blacklisted = AsyncMock(return_value=False)
    mock_blacklist = AsyncMock(return_value=None)
    with (
        patch("app.services.auth.is_jti_blacklisted", mock_is_blacklisted),
        patch("app.dependencies.security.is_jti_blacklisted", mock_is_blacklisted),
        patch("app.services.auth.blacklist_jti", mock_blacklist),
        patch("app.apis.v1.auth_routers.blacklist_jti", mock_blacklist),
    ):
        yield


@pytest_asyncio.fixture(autouse=True, scope="session")  # type: ignore[type-var]
def event_loop() -> None:
    pass
