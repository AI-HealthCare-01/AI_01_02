from datetime import date, timedelta

from app.core.exceptions import AppException, ErrorCode
from app.dtos.reminders import DdayReminderItem, MedicationReminderUpsertRequest
from app.models.reminders import MedicationReminder
from app.models.users import User


class ReminderService:
    async def create_reminder(self, *, user: User, data: MedicationReminderUpsertRequest) -> MedicationReminder:
        return await MedicationReminder.create(
            user_id=user.id,
            medication_name=data.medication_name,
            dose_text=data.dose,
            schedule_times=data.schedule_times,
            start_date=data.start_date,
            end_date=data.end_date,
            dispensed_date=data.dispensed_date,
            total_days=data.total_days,
            daily_intake_count=data.daily_intake_count,
            enabled=data.enabled,
        )

    async def list_reminders(self, *, user: User, enabled: bool | None) -> list[MedicationReminder]:
        qs = MedicationReminder.filter(user_id=user.id)
        if enabled is not None:
            qs = qs.filter(enabled=enabled)
        return await qs.order_by("-created_at")

    async def _get_user_reminder(self, *, user: User, reminder_id: int) -> MedicationReminder:
        reminder = await MedicationReminder.get_or_none(id=reminder_id, user_id=user.id)
        if not reminder:
            raise AppException(ErrorCode.RESOURCE_NOT_FOUND, developer_message="리마인더를 찾을 수 없습니다.")
        return reminder

    async def update_reminder(
        self, *, user: User, reminder_id: int, data: MedicationReminderUpsertRequest
    ) -> MedicationReminder:
        reminder = await self._get_user_reminder(user=user, reminder_id=reminder_id)
        update = data.model_dump(exclude_none=True)
        field_map = {
            "medication_name": "medication_name",
            "dose": "dose_text",
            "schedule_times": "schedule_times",
            "start_date": "start_date",
            "end_date": "end_date",
            "dispensed_date": "dispensed_date",
            "total_days": "total_days",
            "daily_intake_count": "daily_intake_count",
            "enabled": "enabled",
        }
        update_fields = []
        for dto_field, model_field in field_map.items():
            if dto_field in update:
                setattr(reminder, model_field, update[dto_field])
                update_fields.append(model_field)
        if update_fields:
            update_fields.append("updated_at")
            await reminder.save(update_fields=update_fields)
        return reminder

    async def delete_reminder(self, *, user: User, reminder_id: int) -> None:
        reminder = await self._get_user_reminder(user=user, reminder_id=reminder_id)
        await reminder.delete()

    async def get_dday_reminders(self, *, user: User, days: int) -> list[DdayReminderItem]:
        today = date.today()
        reminders = await MedicationReminder.filter(
            user_id=user.id,
            enabled=True,
            dispensed_date__isnull=False,
            total_days__isnull=False,
        )
        result = []
        for r in reminders:
            if r.dispensed_date is None or r.total_days is None:
                continue
            depletion = r.dispensed_date + timedelta(days=r.total_days)
            remaining = (depletion - today).days
            if 0 <= remaining <= days:
                result.append(
                    DdayReminderItem(
                        medication_name=r.medication_name,
                        remaining_days=remaining,
                        estimated_depletion_date=depletion,
                    )
                )
        return sorted(result, key=lambda x: x.remaining_days)
