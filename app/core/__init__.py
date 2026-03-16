import logging

from app.core.config import Config
from app.core.logger import setup_logger


def get_config() -> Config:
    return Config()


def get_logger() -> logging.Logger:
    # 앱 전역에서 사용할 로거
    return setup_logger()


config = get_config()
default_logger = get_logger()

# Startup validation: reject placeholder secrets
_PLACEHOLDER_PREFIX = "CHANGE_ME"
if config.SECRET_KEY.startswith(_PLACEHOLDER_PREFIX):
    raise RuntimeError("SECRET_KEY is still a placeholder. Set a real secret before starting the app.")
if not config.FRONTEND_ORIGIN:
    default_logger.warning("FRONTEND_ORIGIN is empty — CORS will block all cross-origin requests.")
