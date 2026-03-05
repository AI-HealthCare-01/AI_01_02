from datetime import date, datetime, time
from zoneinfo import ZoneInfo

from app.core import config
from app.core.exceptions import AppException, ErrorCode
from app.dtos.schedules import ScheduleItemStatusUpdateRequest
from app.models.reminders import MedicationReminder, ScheduleItem, ScheduleItemCategory, ScheduleItemStatus
from app.models.users import User
from app.services.notification_settings import NotificationSettingService


class ScheduleService:
    def __init__(self) -> None:
        self.notification_setting_service = NotificationSettingService()

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
        setting = await self.notification_setting_service.get_or_create(user=user)
        if not setting.home_schedule_enabled:
            return

        default_items: list[tuple[ScheduleItemCategory, str, str]] = []
        if setting.meal_alarm_enabled:
            default_items.extend(
                [
                    (ScheduleItemCategory.MEAL, "아침 식사", "08:00"),
                    (ScheduleItemCategory.MEAL, "점심 식사", "12:30"),
                    (ScheduleItemCategory.MEAL, "저녁 식사", "18:00"),
                ]
            )
        if setting.exercise_alarm_enabled:
            default_items.append((ScheduleItemCategory.EXERCISE, "운동", "19:30"))
        if setting.sleep_alarm_enabled:
            default_items.append((ScheduleItemCategory.SLEEP, "수면", "22:00"))

        for category, title, time_str in default_items:
            h, m = map(int, time_str.split(":"))
            scheduled_at = datetime.combine(target_date, time(h, m)).replace(tzinfo=tz)
            await ScheduleItem.get_or_create(
                user_id=user.id,
                reminder_id=None,
                scheduled_at=scheduled_at,
                defaults={
                    "category": category,
                    "title": title,
                    "status": ScheduleItemStatus.PENDING,
                },
            )

        if setting.medication_alarm_enabled:
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
                                "title": "복약",
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
        elif data.status == ScheduleItemStatus.PENDING:
            item.completed_at = None  # type: ignore[assignment]
        await item.save(update_fields=["status", "completed_at", "updated_at"])
        return item

    @staticmethod
    def calculate_medication_adherence(items: list[ScheduleItem]) -> tuple[int, int, float]:
        medication_items = [item for item in items if item.category == ScheduleItemCategory.MEDICATION]
        total_count = len(medication_items)
        done_count = len([item for item in medication_items if item.status == ScheduleItemStatus.DONE])
        if total_count == 0:
            return 0, 0, 0.0
        rate = round((done_count / total_count) * 100, 2)
        return done_count, total_count, rate
