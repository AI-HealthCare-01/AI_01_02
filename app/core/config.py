import os
import uuid
import zoneinfo
from datetime import timedelta, timezone, tzinfo
from enum import StrEnum
from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Env(StrEnum):
    LOCAL = "local"
    DEV = "dev"
    PROD = "prod"


def get_default_timezone() -> tzinfo:
    try:
        return zoneinfo.ZoneInfo("Asia/Seoul")
    except zoneinfo.ZoneInfoNotFoundError:
        # Windows or minimal runtime images may miss tzdata.
        return timezone(timedelta(hours=9), name="Asia/Seoul")


class Config(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="allow")

    ENV: Env = Env.LOCAL
    SECRET_KEY: str = f"default-secret-key{uuid.uuid4().hex}"
    TIMEZONE: tzinfo = Field(default_factory=get_default_timezone)
    TEMPLATE_DIR: str = os.path.join(Path(__file__).resolve().parent.parent, "templates")
    MEDIA_DIR: str = os.path.join(Path(__file__).resolve().parent.parent, "media")
    OCR_MAX_FILE_SIZE_BYTES: int = 10 * 1024 * 1024
    OCR_ALLOWED_EXTENSIONS: tuple[str, ...] = ("pdf", "jpg", "jpeg", "png")
    OCR_QUEUE_KEY: str = "ocr:jobs"
    OCR_RETRY_QUEUE_KEY: str = "ocr:jobs:retry"
    OCR_DEAD_LETTER_QUEUE_KEY: str = "ocr:jobs:dead-letter"
    OCR_RETRY_BACKOFF_BASE_SECONDS: int = 5
    OCR_RETRY_BACKOFF_MAX_SECONDS: int = 60
    OCR_RETRY_RELEASE_BATCH_SIZE: int = 100
    OCR_JOB_MAX_RETRIES: int = 3
    GUIDE_QUEUE_KEY: str = "guide:jobs"
    GUIDE_JOB_MAX_RETRIES: int = 3

    DB_HOST: str = "localhost"
    DB_PORT: int = 3306
    DB_USER: str = "root"
    DB_PASSWORD: str = "pw1234"
    DB_NAME: str = "ai_health"
    DB_CONNECT_TIMEOUT: int = 5
    DB_CONNECTION_POOL_MAXSIZE: int = 10
    REDIS_HOST: str = "localhost"
    REDIS_PORT: int = 6379
    REDIS_DB: int = 0
    REDIS_PASSWORD: str | None = None
    REDIS_SOCKET_TIMEOUT_SECONDS: float = 0.2

    COOKIE_DOMAIN: str = "localhost"

    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    REFRESH_TOKEN_EXPIRE_MINUTES: int = 14 * 24 * 60
    JWT_LEEWAY: int = 5
