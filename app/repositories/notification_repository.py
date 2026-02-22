from datetime import datetime
from typing import Any

from tortoise.queryset import QuerySet

from app.core import config
from app.models.notifications import Notification, NotificationType


class NotificationRepository:
    def __init__(self):
        self._model = Notification

    async def create_notification(
        self,
        *,
        user_id: int,
        title: str,
        message: str,
        notification_type: NotificationType = NotificationType.SYSTEM,
        payload: dict[str, Any] | None = None,
    ) -> Notification:
        return await self._model.create(
            user_id=user_id,
            title=title,
            message=message,
            type=notification_type,
            payload=payload or {},
        )

    async def list_notifications(
        self,
        *,
        user_id: int,
        limit: int,
        offset: int,
        is_read: bool | None = None,
    ) -> list[Notification]:
        query: QuerySet[Notification] = self._model.filter(user_id=user_id)
        if is_read is not None:
            query = query.filter(is_read=is_read)
        return await query.order_by("-created_at", "-id").offset(offset).limit(limit)

    async def count_unread(self, *, user_id: int) -> int:
        return await self._model.filter(user_id=user_id, is_read=False).count()

    async def get_user_notification(self, *, notification_id: int, user_id: int) -> Notification | None:
        return await self._model.get_or_none(id=notification_id, user_id=user_id)

    async def mark_as_read(self, notification: Notification) -> Notification:
        if notification.is_read:
            return notification
        notification.is_read = True
        notification.read_at = datetime.now(config.TIMEZONE)
        await notification.save(update_fields=["is_read", "read_at"])
        return notification

    async def mark_all_as_read(self, *, user_id: int) -> int:
        return await self._model.filter(user_id=user_id, is_read=False).update(
            is_read=True,
            read_at=datetime.now(config.TIMEZONE),
        )
