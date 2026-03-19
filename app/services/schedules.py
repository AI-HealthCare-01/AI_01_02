from datetime import date, datetime, time
from zoneinfo import ZoneInfo

from app.core import config
from app.core.exceptions import AppException, ErrorCode
from app.core.logger import default_logger as logger
from app.dtos.schedules import ScheduleItemStatusUpdateRequest
from app.models.reminders import ScheduleItem, ScheduleItemCategory, ScheduleItemStatus
from app.models.users import User
from app.services.notification_settings import NotificationSettingService
from app.services.prescriptions import PrescriptionService


class ScheduleService:
    def __init__(self) -> None:
        self.notification_setting_service = NotificationSettingService()
        self.prescription_service = PrescriptionService()

    async def get_daily_schedule(self, *, user: User, target_date: date, timezone: str | None) -> tuple[list[ScheduleItem], list]:
        try:
            tz = ZoneInfo(timezone) if timezone else config.TIMEZONE
        except Exception:  # noqa: BLE001
            logger.warning("invalid timezone '%s', falling back to default", timezone)
            tz = config.TIMEZONE

        day_start = datetime.combine(target_date, time.min).replace(tzinfo=tz)
        day_end = datetime.combine(target_date, time.max).replace(tzinfo=tz)

        await self.schedule_sync(user=user, target_date=target_date, tz=tz)
        items = await ScheduleItem.filter(
            user_id=user.id,
            scheduled_at__gte=day_start,
            scheduled_at__lte=day_end,
        ).order_by("scheduled_at")
        medications = await self.prescription_service.build_daily_medication_entries(user=user, target_date=target_date)
        return items, medications

    async def schedule_sync(self, *, user: User, target_date: date, tz) -> None:
        setting = await self.notification_setting_service.get_or_create(user=user)
        desired_specs = await self._build_desired_schedule_specs(
            user=user, target_date=target_date, tz=tz, setting=setting
        )

        day_start = datetime.combine(target_date, time.min).replace(tzinfo=tz)
        day_end = datetime.combine(target_date, time.max).replace(tzinfo=tz)
        existing_items = await ScheduleItem.filter(
            user_id=user.id,
            scheduled_at__gte=day_start,
            scheduled_at__lte=day_end,
        )

        existing_map = {
            (item.category, item.title, item.scheduled_at, item.reminder_id, item.medication_name): item
            for item in existing_items
        }
        desired_keys = set(desired_specs.keys())
        existing_keys = set(existing_map.keys())

        remove_ids = [existing_map[key].id for key in (existing_keys - desired_keys)]
        if remove_ids:
            await ScheduleItem.filter(id__in=remove_ids, user_id=user.id).delete()

        create_keys = desired_keys - existing_keys
        if create_keys:
            await ScheduleItem.bulk_create(
                [
                    ScheduleItem(
                        user_id=user.id,
                        reminder_id=reminder_id,
                        medication_name=medication_name,
                        scheduled_at=scheduled_at,
                        category=category,
                        title=title,
                        status=ScheduleItemStatus.PENDING,
                    )
                    for category, title, scheduled_at, reminder_id, medication_name in create_keys
                ]
            )

    async def _build_desired_schedule_specs(self, *, user: User, target_date: date, tz, setting) -> dict[tuple, None]:
        desired: dict[tuple, None] = {}
        if not setting.home_schedule_enabled:
            return desired

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
            desired[(category, title, scheduled_at, None, None)] = None

        if setting.medication_alarm_enabled:
            prescription_medications = await self.prescription_service.get_medications_for_date(
                user=user,
                target_date=target_date,
            )
            for medication in prescription_medications:
                schedule_times = medication.schedule_times if isinstance(medication.schedule_times, list) else []
                for time_str in schedule_times:
                    try:
                        h, m = map(int, str(time_str).split(":"))
                        scheduled_at = datetime.combine(target_date, time(h, m)).replace(tzinfo=tz)
                        desired[(
                            ScheduleItemCategory.MEDICATION,
                            "복약",
                            scheduled_at,
                            None,
                            medication.medication_name,
                        )] = None
                    except (ValueError, AttributeError):
                        continue
        return desired

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

    @staticmethod
    def calculate_medication_adherence(items: list[ScheduleItem]) -> tuple[int, int, float]:
        medication_items = [item for item in items if item.category == ScheduleItemCategory.MEDICATION]
        total_count = len(medication_items)
        done_count = len([item for item in medication_items if item.status == ScheduleItemStatus.DONE])
        if total_count == 0:
            return 0, 0, 0.0
        rate = round((done_count / total_count) * 100, 2)
        return done_count, total_count, rate
