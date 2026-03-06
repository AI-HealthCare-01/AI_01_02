from datetime import date, datetime, time
from zoneinfo import ZoneInfo

from app.core import config
from app.core.exceptions import AppException, ErrorCode
from app.dtos.schedules import ScheduleItemStatusUpdateRequest
from app.models.reminders import MedicationReminder, ScheduleItem, ScheduleItemCategory, ScheduleItemStatus
from app.models.users import User


class ScheduleService:
    async def get_daily_schedule(self, *, user: User, target_date: date, timezone: str | None) -> list[ScheduleItem]:
        try:
            tz = ZoneInfo(timezone) if timezone else config.TIMEZONE
        except Exception:  # noqa: BLE001
            tz = config.TIMEZONE

        day_start = datetime.combine(target_date, time.min).replace(tzinfo=tz)
        day_end = datetime.combine(target_date, time.max).replace(tzinfo=tz)

        items = await ScheduleItem.filter(
            user_id=user.id,
            scheduled_at__gte=day_start,
            scheduled_at__lte=day_end,
        ).order_by("scheduled_at")

        if not items:
            await self._generate_schedule_items(user=user, target_date=target_date, tz=tz)
            items = await ScheduleItem.filter(
                user_id=user.id,
                scheduled_at__gte=day_start,
                scheduled_at__lte=day_end,
            ).order_by("scheduled_at")

        return items

    async def _generate_schedule_items(self, *, user: User, target_date: date, tz) -> None:
        reminders = await MedicationReminder.filter(user_id=user.id, enabled=True)
        for reminder in reminders:
            if reminder.start_date and target_date < reminder.start_date:
                continue
            if reminder.end_date and target_date > reminder.end_date:
                continue
            for time_str in reminder.schedule_times:
                try:
                    h, m = map(int, str(time_str).split(":"))
                    scheduled_at = datetime.combine(target_date, time(h, m)).replace(tzinfo=tz)
                    await ScheduleItem.get_or_create(
                        user_id=user.id,
                        reminder_id=reminder.id,
                        scheduled_at=scheduled_at,
                        defaults={
                            "category": ScheduleItemCategory.MEDICATION,
                            "title": reminder.medication_name,
                            "status": ScheduleItemStatus.PENDING,
                        },
                    )
                except (ValueError, AttributeError):
                    continue

    async def update_item_status(
        self, *, user: User, item_id: int, data: ScheduleItemStatusUpdateRequest
    ) -> ScheduleItem:
        item = await ScheduleItem.get_or_none(id=item_id, user_id=user.id)
        if not item:
            raise AppException(ErrorCode.RESOURCE_NOT_FOUND, developer_message="일정 항목을 찾을 수 없습니다.")
        item.status = data.status
        if data.status == ScheduleItemStatus.DONE:
            item.completed_at = data.completed_at or datetime.now(config.TIMEZONE)
        elif data.status in (ScheduleItemStatus.PENDING, ScheduleItemStatus.SKIPPED):
            item.completed_at = None  # type: ignore[assignment]
        await item.save(update_fields=["status", "completed_at", "updated_at"])
        return item
