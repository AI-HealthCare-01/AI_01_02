import zoneinfo
from datetime import timedelta, timezone, tzinfo
from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


def get_default_timezone() -> tzinfo:
    try:
        return zoneinfo.ZoneInfo("Asia/Seoul")
    except zoneinfo.ZoneInfoNotFoundError:
        return timezone(timedelta(hours=9), name="Asia/Seoul")


class Config(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="allow")

    TIMEZONE: tzinfo = Field(default_factory=get_default_timezone)
    MEDIA_DIR: str = str(Path(__file__).resolve().parents[2] / "app" / "media")
    OCR_QUEUE_KEY: str = "ocr:jobs"
    OCR_RETRY_QUEUE_KEY: str = "ocr:jobs:retry"
    OCR_DEAD_LETTER_QUEUE_KEY: str = "ocr:jobs:dead-letter"
    OCR_RETRY_BACKOFF_BASE_SECONDS: int = 5
    OCR_RETRY_BACKOFF_MAX_SECONDS: int = 60
    OCR_RETRY_RELEASE_BATCH_SIZE: int = 100
    OCR_QUEUE_BLOCK_TIMEOUT_SECONDS: int = 1
    GUIDE_QUEUE_KEY: str = "guide:jobs"
    GUIDE_RETRY_QUEUE_KEY: str = "guide:jobs:retry"
    GUIDE_DEAD_LETTER_QUEUE_KEY: str = "guide:jobs:dead-letter"
    GUIDE_RETRY_BACKOFF_BASE_SECONDS: int = 5
    GUIDE_RETRY_BACKOFF_MAX_SECONDS: int = 60
    GUIDE_RETRY_RELEASE_BATCH_SIZE: int = 100
    GUIDE_QUEUE_BLOCK_TIMEOUT_SECONDS: int = 1
    HEARTBEAT_INTERVAL_SECONDS: int = 30
    REDIS_HOST: str = "localhost"
    REDIS_PORT: int = 6379
    REDIS_DB: int = 0
    REDIS_PASSWORD: str | None = None
    REDIS_SOCKET_TIMEOUT_SECONDS: float = 1.0
