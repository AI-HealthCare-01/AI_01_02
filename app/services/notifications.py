import asyncio
import time
from datetime import datetime

from tortoise.transactions import in_transaction

from app.core import config
from app.core.exceptions import AppException, ErrorCode
from app.core.logger import default_logger as logger
from app.models.notifications import Notification, NotificationType
from app.models.users import User
from app.repositories.notification_repository import NotificationRepository
from app.services.analysis import AnalysisService
from app.services.emergency_guidance import generate_medication_dday_guidance
from app.services.guide_automation import GuideAutomationService
from app.services.notification_settings import NotificationSettingService
from app.services.reminders import ReminderService

_SYNC_TTL_SECONDS = 300  # 5분
_SYNC_CACHE_MAX_SIZE = 10_000
_sync_cache: dict[int, float] = {}


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
        now = time.monotonic()
        last_sync = _sync_cache.get(user.id)
        if last_sync is None or now - last_sync >= _SYNC_TTL_SECONDS:
            await self._sync_dynamic_notifications(user=user)
            if len(_sync_cache) >= _SYNC_CACHE_MAX_SIZE:
                _sync_cache.clear()
            _sync_cache[user.id] = now
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
            raise AppException(ErrorCode.RESOURCE_NOT_FOUND, developer_message="알림을 찾을 수 없습니다.")
        async with in_transaction():
            await self.repo.mark_as_read(notification)
            await notification.refresh_from_db()
        return notification

    async def mark_all_as_read(self, *, user: User) -> int:
        async with in_transaction():
            return await self.repo.mark_all_as_read(user_id=user.id)

    async def delete_read_notifications(self, *, user: User) -> int:
        async with in_transaction():
            return await self.repo.delete_read_notifications(user_id=user.id)

    async def _sync_dynamic_notifications(self, *, user: User) -> None:
        await self.guide_automation_service.notify_weekly_refresh_if_due(user_id=user.id)
        results = await asyncio.gather(
            self._sync_health_alert_notifications(user=user),
            self._sync_dday_notifications(user=user),
            return_exceptions=True,
        )
        for result in results:
            if isinstance(result, Exception):
                logger.warning("notification_sync_partial_failure", extra={"error": str(result)})

    async def _sync_dday_notifications(self, *, user: User) -> None:
        setting = await self.notification_setting_service.get_or_create(user=user)
        if not setting.medication_dday_alarm_enabled:
            return

        dday_items = await self.reminder_service.get_dday_reminders(user=user, days=5)
        if not dday_items:
            return

        # Step 1: gather existing keys outside transaction
        existing_dday_notifications = await Notification.filter(
            user_id=user.id,
            type=NotificationType.MEDICATION_DDAY,
        ).only("id", "payload", "created_at")
        today = datetime.now(config.TIMEZONE).date()
        existing_keys: set[tuple[str, int]] = set()
        existing_daily_medication_keys: set[str] = set()
        for notification in existing_dday_notifications:
            payload = notification.payload if isinstance(notification.payload, dict) else {}
            medication_name = str(payload.get("medication_name") or "")
            remaining_days = int(payload.get("remaining_days") or -1)
            existing_keys.add((medication_name, remaining_days))
            if medication_name and notification.created_at.astimezone(config.TIMEZONE).date() == today:
                existing_daily_medication_keys.add(medication_name)

        # Step 2: filter new items and generate LLM messages in parallel
        items_to_generate = []
        for item in dday_items:
            dedup_key = (item.medication_name, item.remaining_days)
            if dedup_key in existing_keys:
                continue
            if item.medication_name in existing_daily_medication_keys:
                continue
            items_to_generate.append(item)
            existing_keys.add(dedup_key)
            existing_daily_medication_keys.add(item.medication_name)

        if not items_to_generate:
            return

        messages = await asyncio.gather(
            *(
                generate_medication_dday_guidance(
                    medication_name=item.medication_name,
                    remaining_days=item.remaining_days,
                )
                for item in items_to_generate
            )
        )
        new_items = list(zip(items_to_generate, messages, strict=True))

        # Step 3: batch write inside transaction with dedup re-check
        async with in_transaction():
            fresh_existing = await Notification.filter(
                user_id=user.id,
                type=NotificationType.MEDICATION_DDAY,
            ).only("id", "payload", "created_at")
            fresh_keys: set[tuple[str, int]] = set()
            fresh_daily_keys: set[str] = set()
            for n in fresh_existing:
                p = n.payload if isinstance(n.payload, dict) else {}
                med_name = str(p.get("medication_name") or "")
                fresh_keys.add((med_name, int(p.get("remaining_days") or -1)))
                if med_name and n.created_at.astimezone(config.TIMEZONE).date() == today:
                    fresh_daily_keys.add(med_name)

            for item, dday_message in new_items:
                if (item.medication_name, item.remaining_days) in fresh_keys:
                    continue
                if item.medication_name in fresh_daily_keys:
                    continue
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

        async with in_transaction():
            today = datetime.now(config.TIMEZONE).date()
            existing_alert_notifications = await Notification.filter(
                user_id=user.id,
                type=NotificationType.HEALTH_ALERT,
            ).only("id", "payload", "created_at")
            existing_alerts_by_key: dict[str, list[Notification]] = {}
            for notification in existing_alert_notifications:
                payload = notification.payload if isinstance(notification.payload, dict) else {}
                alert_key = str(payload.get("alert_key") or "")
                if alert_key:
                    existing_alerts_by_key.setdefault(alert_key, []).append(notification)

            for alert in emergency_alerts:
                if not isinstance(alert, dict):
                    continue
                alert_key = str(alert.get("alert_key") or "")
                if not alert_key:
                    continue
                source_ocr_job_id = int(alert.get("source_ocr_job_id") or 0)
                profile_updated_at = str(alert.get("profile_updated_at") or "")

                existing_today = [
                    notification
                    for notification in existing_alerts_by_key.get(alert_key, [])
                    if notification.created_at.astimezone(config.TIMEZONE).date() == today
                ]
                already_notified_for_same_source = False
                for notification in existing_today:
                    payload = notification.payload if isinstance(notification.payload, dict) else {}
                    existing_source_ocr_job_id = int(payload.get("source_ocr_job_id") or 0)
                    existing_profile_updated_at = str(payload.get("profile_updated_at") or "")
                    if (
                        existing_source_ocr_job_id == source_ocr_job_id
                        and existing_profile_updated_at == profile_updated_at
                    ):
                        already_notified_for_same_source = True
                        break
                if already_notified_for_same_source:
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
                        "source_ocr_job_id": source_ocr_job_id,
                        "profile_updated_at": profile_updated_at,
                    },
                )
