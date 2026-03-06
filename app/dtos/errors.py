from datetime import datetime
from typing import Any

from pydantic import BaseModel


class ApiError(BaseModel):
    code: str
    message: str
    detail: Any = None
    action_hint: str | None = None
    retryable: bool = False
    request_id: str | None = None
    timestamp: datetime
