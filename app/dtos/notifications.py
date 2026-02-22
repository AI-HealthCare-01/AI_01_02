from datetime import datetime
from typing import Any

from pydantic import BaseModel

from app.dtos.base import BaseSerializerModel
from app.models.notifications import NotificationType


class NotificationInfoResponse(BaseSerializerModel):
    id: int
    type: NotificationType
    title: str
    message: str
    is_read: bool
    read_at: datetime | None
    payload: dict[str, Any]
    created_at: datetime


class NotificationListResponse(BaseModel):
    items: list[NotificationInfoResponse]
    unread_count: int


class UnreadCountResponse(BaseModel):
    unread_count: int


class ReadAllNotificationsResponse(BaseModel):
    updated_count: int
