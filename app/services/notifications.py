from fastapi import HTTPException, status
from tortoise.transactions import in_transaction

from app.models.notifications import Notification
from app.models.users import User
from app.repositories.notification_repository import NotificationRepository


class NotificationService:
    def __init__(self):
        self.repo = NotificationRepository()

    async def list_notifications(
        self,
        *,
        user: User,
        limit: int,
        offset: int,
        is_read: bool | None = None,
    ) -> tuple[list[Notification], int]:
        notifications = await self.repo.list_notifications(
            user_id=user.id,
            limit=limit,
            offset=offset,
            is_read=is_read,
        )
        unread_count = await self.repo.count_unread(user_id=user.id)
        return notifications, unread_count

    async def get_unread_count(self, *, user: User) -> int:
        return await self.repo.count_unread(user_id=user.id)

    async def mark_as_read(self, *, user: User, notification_id: int) -> Notification:
        notification = await self.repo.get_user_notification(notification_id=notification_id, user_id=user.id)
        if not notification:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="알림을 찾을 수 없습니다.")
        async with in_transaction():
            await self.repo.mark_as_read(notification)
            await notification.refresh_from_db()
        return notification

    async def mark_all_as_read(self, *, user: User) -> int:
        async with in_transaction():
            return await self.repo.mark_all_as_read(user_id=user.id)
