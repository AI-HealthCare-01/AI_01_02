from typing import Any

from app.core import config
from app.core.config import Env

_LOCAL_COOKIE_DOMAINS = {"", "localhost", "127.0.0.1", "0.0.0.0", "host.docker.internal"}


def get_refresh_cookie_kwargs() -> dict[str, Any]:
    """Use host-only cookies for local development to avoid browser localhost domain rejection."""
    kwargs: dict[str, Any] = {
        "httponly": True,
        "secure": config.ENV == Env.PROD,
        "samesite": "lax",
    }
    domain = (config.COOKIE_DOMAIN or "").strip()
    if domain not in _LOCAL_COOKIE_DOMAINS:
        kwargs["domain"] = domain
    return kwargs
