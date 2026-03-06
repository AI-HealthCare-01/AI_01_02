from tortoise.transactions import in_transaction

from app.core.exceptions import AppException, ErrorCode
from app.models.notifications import Notification, NotificationType
from app.models.users import User
from app.repositories.notification_repository import NotificationRepository
from app.services.analysis import AnalysisService
from app.services.emergency_guidance import generate_medication_dday_guidance
from app.services.guide_automation import GuideAutomationService
from app.services.notification_settings import NotificationSettingService
from app.services.reminders import ReminderService


class NotificationService:
    def __init__(self):
        self.repo = NotificationRepository()
        self.reminder_service = ReminderService()
        self.notification_setting_service = NotificationSettingService()
        self.analysis_service = AnalysisService()
        self.guide_automation_service = GuideAutomationService()

    async def list_notifications(
        self,
        *,
        user: User,
        limit: int,
        offset: int,
        is_read: bool | None = None,
    ) -> tuple[list[Notification], int]:
        await self._sync_dynamic_notifications(user=user)
        notifications = await self.repo.list_notifications(
            user_id=user.id,
            limit=limit,
            offset=offset,
            is_read=is_read,
        )
        unread_count = await self.repo.count_unread(user_id=user.id)
        return notifications, unread_count

    async def get_unread_count(self, *, user: User) -> int:
        await self._sync_dynamic_notifications(user=user)
        return await self.repo.count_unread(user_id=user.id)

    async def mark_as_read(self, *, user: User, notification_id: int) -> Notification:
        notification = await self.repo.get_user_notification(notification_id=notification_id, user_id=user.id)
        if not notification:
            raise AppException(ErrorCode.RESOURCE_NOT_FOUND, developer_message="알림을 찾을 수 없습니다.")
        async with in_transaction():
            await self.repo.mark_as_read(notification)
            await notification.refresh_from_db()
        return notification

    async def mark_all_as_read(self, *, user: User) -> int:
        async with in_transaction():
            return await self.repo.mark_all_as_read(user_id=user.id)

    async def _sync_dynamic_notifications(self, *, user: User) -> None:
        await self.guide_automation_service.notify_weekly_refresh_if_due(user_id=user.id)
        await self._sync_health_alert_notifications(user=user)
        await self._sync_dday_notifications(user=user)

    async def _sync_dday_notifications(self, *, user: User) -> None:
        setting = await self.notification_setting_service.get_or_create(user=user)
        if not setting.medication_dday_alarm_enabled:
            return

        dday_items = await self.reminder_service.get_dday_reminders(user=user, days=5)
        if not dday_items:
            return

        existing_notifications = await self.repo.list_notifications(
            user_id=user.id,
            limit=100,
            offset=0,
            is_read=None,
        )
        existing_keys: set[tuple[str, int]] = set()
        for notification in existing_notifications:
            if notification.type != NotificationType.MEDICATION_DDAY:
                continue
            payload = notification.payload if isinstance(notification.payload, dict) else {}
            medication_name = str(payload.get("medication_name") or "")
            remaining_days = int(payload.get("remaining_days") or -1)
            existing_keys.add((medication_name, remaining_days))

        for item in dday_items:
            dedup_key = (item.medication_name, item.remaining_days)
            if dedup_key in existing_keys:
                continue
            dday_message = await generate_medication_dday_guidance(
                medication_name=item.medication_name,
                remaining_days=item.remaining_days,
            )
            await self.repo.create_notification(
                user_id=user.id,
                title="약 소진 알림",
                message=dday_message,
                notification_type=NotificationType.MEDICATION_DDAY,
                payload={
                    "event": "medication_dday",
                    "medication_name": item.medication_name,
                    "remaining_days": item.remaining_days,
                    "estimated_depletion_date": item.estimated_depletion_date.isoformat(),
                },
            )

    async def _sync_health_alert_notifications(self, *, user: User) -> None:
        summary = await self.analysis_service.get_summary(user=user)
        emergency_alerts = summary.get("emergency_alerts", [])
        if not emergency_alerts:
            return

        existing_notifications = await self.repo.list_notifications(
            user_id=user.id,
            limit=100,
            offset=0,
            is_read=None,
        )
        existing_alert_keys: set[str] = set()
        for notification in existing_notifications:
            if notification.type != NotificationType.HEALTH_ALERT:
                continue
            payload = notification.payload if isinstance(notification.payload, dict) else {}
            alert_key = str(payload.get("alert_key") or "")
            if alert_key:
                existing_alert_keys.add(alert_key)

        for alert in emergency_alerts:
            if not isinstance(alert, dict):
                continue
            alert_key = str(alert.get("alert_key") or "")
            if not alert_key or alert_key in existing_alert_keys:
                continue
            await self.repo.create_notification(
                user_id=user.id,
                title=str(alert.get("title") or "건강 경고 알림"),
                message=str(alert.get("message") or ""),
                notification_type=NotificationType.HEALTH_ALERT,
                payload={
                    "event": "health_alert",
                    "alert_key": alert_key,
                    "alert_type": str(alert.get("type") or "GENERAL"),
                    "severity": str(alert.get("severity") or "MEDIUM"),
                },
            )
