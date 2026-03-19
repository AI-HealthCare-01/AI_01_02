import re
from datetime import date, datetime, timedelta
from typing import Any

from app.core import config
from app.core.exceptions import AppException, ErrorCode
from app.dtos.reminders import DdayReminderItem, MedicationReminderUpsertRequest
from app.models.ocr import OcrJob, OcrJobStatus
from app.models.reminders import MedicationReminder
from app.models.users import User


class ReminderService:
    _INTAKE_TIME_MAP = {
        "morning": "08:00",
        "lunch": "13:00",
        "dinner": "19:00",
        "bedtime": "22:00",
        "prn": "12:00",
        "아침": "08:00",
        "점심": "13:00",
        "저녁": "19:00",
        "취침전": "22:00",
        "취침 전": "22:00",
    }

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

    async def list_reminders(
        self, *, user: User, enabled: bool | None, limit: int = 50, offset: int = 0
    ) -> list[MedicationReminder]:
        await self.backfill_legacy_dose_texts_from_ocr(user=user)
        qs = MedicationReminder.filter(user_id=user.id)
        if enabled is not None:
            qs = qs.filter(enabled=enabled)
        return await qs.order_by("-created_at").offset(offset).limit(limit)

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

    @staticmethod
    async def disable_depleted_reminders() -> int:
        """소진된(dispensed_date + total_days < today) 리마인더를 자동 비활성화. 비활성화한 건수 반환."""
        today = datetime.now(config.TIMEZONE).date()
        reminders = await MedicationReminder.filter(
            enabled=True,
            dispensed_date__isnull=False,
            total_days__isnull=False,
        )
        depleted_ids = [r.id for r in reminders if r.dispensed_date + timedelta(days=r.total_days) < today]
        if not depleted_ids:
            return 0
        count = await MedicationReminder.filter(id__in=depleted_ids).update(enabled=False)
        return count

    async def get_dday_reminders(self, *, user: User, days: int) -> list[DdayReminderItem]:
        today = datetime.now(config.TIMEZONE).date()
        reminders = await MedicationReminder.filter(
            user_id=user.id,
            enabled=True,
            dispensed_date__isnull=False,
            total_days__isnull=False,
        )
        result = []
        for r in reminders:
            depletion = r.dispensed_date + timedelta(days=r.total_days)
            remaining = self._calculate_remaining_days(depletion=depletion, today=today)
            if 0 <= remaining <= days:
                result.append(
                    DdayReminderItem(
                        medication_name=r.medication_name,
                        remaining_days=remaining,
                        estimated_depletion_date=depletion,
                    )
                )
        return sorted(result, key=lambda x: x.remaining_days)

    async def sync_from_ocr_medications(self, *, user: User, medications: list[dict[str, Any]]) -> None:
        existing_reminders = await MedicationReminder.filter(user_id=user.id)
        existing_by_name: dict[str, MedicationReminder] = {r.medication_name: r for r in existing_reminders}

        for med in medications:
            if not isinstance(med, dict):
                continue

            medication_name = str(med.get("drug_name") or "").strip()
            if not medication_name:
                continue

            schedule_times = self._extract_schedule_times(med)
            if not schedule_times:
                schedule_times = ["09:00"]

            dispensed_date = self._parse_date(med.get("dispensed_date"))
            total_days = self._parse_int(med.get("total_days"))
            if total_days is not None and total_days <= 0:
                total_days = None

            dose_text = self._extract_dose_text(med)
            daily_intake_count = self._parse_int(med.get("frequency_per_day"))

            existing = existing_by_name.get(medication_name)
            if existing:
                existing.schedule_times = schedule_times
                existing.dose_text = dose_text
                existing.dispensed_date = dispensed_date
                existing.total_days = total_days
                existing.daily_intake_count = daily_intake_count
                existing.enabled = True
                await existing.save(
                    update_fields=[
                        "schedule_times",
                        "dose_text",
                        "dispensed_date",
                        "total_days",
                        "daily_intake_count",
                        "enabled",
                        "updated_at",
                    ]
                )
                continue

            new_reminder = await MedicationReminder.create(
                user_id=user.id,
                medication_name=medication_name,
                dose_text=dose_text,
                schedule_times=schedule_times,
                dispensed_date=dispensed_date,
                total_days=total_days,
                daily_intake_count=daily_intake_count,
                enabled=True,
            )
            existing_by_name[medication_name] = new_reminder

    async def backfill_legacy_dose_texts_from_ocr(self, *, user: User) -> int:
        reminders = await MedicationReminder.filter(user_id=user.id)
        legacy_reminders = [r for r in reminders if self._is_legacy_numeric_dose_text(r.dose_text)]
        if not legacy_reminders:
            return 0

        target_names = {r.medication_name for r in legacy_reminders}
        dosage_text_by_name: dict[str, str] = {}
        jobs = await OcrJob.filter(user_id=user.id, status=OcrJobStatus.SUCCEEDED).order_by("-completed_at", "-id")
        for job in jobs:
            medications = self._extract_ocr_medications(job)
            for med in medications:
                medication_name = str(med.get("drug_name") or "").strip()
                if not medication_name or medication_name not in target_names or medication_name in dosage_text_by_name:
                    continue
                dose_text = self._extract_dose_text(med)
                if dose_text and "캡/정" in dose_text:
                    dosage_text_by_name[medication_name] = dose_text
            if target_names.issubset(dosage_text_by_name.keys()):
                break

        updated_count = 0
        for reminder in legacy_reminders:
            corrected_dose_text = dosage_text_by_name.get(reminder.medication_name)
            if not corrected_dose_text or corrected_dose_text == reminder.dose_text:
                continue
            reminder.dose_text = corrected_dose_text
            await reminder.save(update_fields=["dose_text", "updated_at"])
            updated_count += 1
        return updated_count

    @classmethod
    def _extract_schedule_times(cls, med: dict[str, Any]) -> list[str]:
        raw = med.get("intake_time")
        values: list[str] = []
        if isinstance(raw, list):
            values = [str(x).strip().lower() for x in raw if str(x).strip()]
        elif isinstance(raw, str) and raw.strip():
            values = [raw.strip().lower()]

        mapped = [cls._INTAKE_TIME_MAP[v] for v in values if v in cls._INTAKE_TIME_MAP]
        if mapped:
            return sorted(set(mapped))

        freq = cls._parse_int(med.get("frequency_per_day"))
        if freq is None:
            return []
        if freq <= 1:
            return ["09:00"]
        if freq == 2:
            return ["09:00", "21:00"]
        return ["08:00", "13:00", "19:00"]

    @staticmethod
    def _parse_date(value: Any) -> date | None:
        if isinstance(value, date):
            return value
        if isinstance(value, str):
            try:
                return datetime.strptime(value, "%Y-%m-%d").date()
            except ValueError:
                return None
        return None

    @staticmethod
    def _parse_int(value: Any) -> int | None:
        if isinstance(value, bool):
            return None
        if isinstance(value, int):
            return value
        if isinstance(value, float):
            return int(value)
        if isinstance(value, str) and value.strip():
            try:
                return int(float(value.strip()))
            except ValueError:
                return None
        return None

    @staticmethod
    def _extract_dose_text(med: dict[str, Any]) -> str | None:
        dosage_per_once = ReminderService._parse_int(med.get("dosage_per_once"))
        if dosage_per_once is not None and dosage_per_once > 0:
            return f"{dosage_per_once} 캡/정"

        dose = med.get("dose")
        if dose is None:
            return None
        if isinstance(dose, int | float):
            return str(dose)
        text = str(dose).strip()
        return text or None

    @staticmethod
    def _calculate_remaining_days(*, depletion: date, today: date) -> int:
        return (depletion - today).days - 1

    @staticmethod
    def _extract_ocr_medications(job: OcrJob) -> list[dict[str, Any]]:
        confirmed_result = job.confirmed_result if isinstance(job.confirmed_result, dict) else {}
        structured_result = job.structured_result if isinstance(job.structured_result, dict) else {}
        medications = confirmed_result.get("extracted_medications")
        if not isinstance(medications, list):
            medications = structured_result.get("extracted_medications")
        if not isinstance(medications, list):
            medications = structured_result.get("medications")
        return [med for med in medications if isinstance(med, dict)]

    @staticmethod
    def _is_legacy_numeric_dose_text(value: str | None) -> bool:
        if not value:
            return False
        return bool(re.fullmatch(r"\d+(?:\.\d+)?", value.strip()))
