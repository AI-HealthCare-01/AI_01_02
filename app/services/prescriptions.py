from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime, timedelta
from typing import Any

from app.core import config
from app.models.prescriptions import PrescriptionHistory, PrescriptionMedication
from app.models.users import User
from app.services.reminders import ReminderService


@dataclass(frozen=True)
class DailyPrescriptionMedication:
    drug_name: str
    dose: float | None
    frequency_per_day: int | None
    dosage_per_once: int | None
    intake_time: str | None
    dispensed_date: date | None
    total_days: int | None


class PrescriptionService:
    def __init__(self) -> None:
        self.reminder_service = ReminderService()

    async def sync_from_ocr_confirmation(
        self,
        *,
        user: User,
        source_ocr_job_id: int,
        medications: list[dict[str, Any]],
    ) -> PrescriptionHistory | None:
        fallback_date = datetime.now(config.TIMEZONE).date()
        normalized = [
            normalized_item
            for med in medications
            if isinstance(med, dict)
            for normalized_item in [self._normalize_medication(med, fallback_date=fallback_date)]
            if normalized_item is not None
        ]
        if not normalized:
            return None

        overall_start = min(item["start_date"] for item in normalized)
        overall_end = max(item["end_date"] for item in normalized)
        days_supply = max((overall_end - overall_start).days + 1, 1)

        history = await PrescriptionHistory.get_or_none(source_ocr_job_id=source_ocr_job_id)
        if history:
            history.prescribed_date = overall_start
            history.days_supply = days_supply
            history.start_date = overall_start
            history.end_date = overall_end
            await history.save(update_fields=["prescribed_date", "days_supply", "start_date", "end_date", "updated_at"])
            await PrescriptionMedication.filter(prescription_id=history.id).delete()
        else:
            history = await PrescriptionHistory.create(
                user_id=user.id,
                source_ocr_job_id=source_ocr_job_id,
                prescribed_date=overall_start,
                days_supply=days_supply,
                start_date=overall_start,
                end_date=overall_end,
            )

        await PrescriptionMedication.bulk_create(
            [
                PrescriptionMedication(
                    prescription_id=history.id,
                    medication_name=item["medication_name"],
                    dose=item["dose"],
                    frequency_per_day=item["frequency_per_day"],
                    dosage_per_once=item["dosage_per_once"],
                    schedule_times=item["schedule_times"],
                    administration_timing=item["administration_timing"],
                    dispensed_date=item["dispensed_date"],
                    total_days=item["total_days"],
                    start_date=item["start_date"],
                    end_date=item["end_date"],
                    raw_payload=item["raw_payload"],
                )
                for item in normalized
            ]
        )

        return history

    async def get_effective_prescription(self, *, user: User, target_date: date) -> PrescriptionHistory | None:
        return await PrescriptionHistory.filter(
            user_id=user.id,
            start_date__lte=target_date,
            end_date__gte=target_date,
        ).order_by("-start_date", "-prescribed_date", "-created_at", "-id").first()

    async def get_medications_for_date(self, *, user: User, target_date: date) -> list[PrescriptionMedication]:
        history = await self.get_effective_prescription(user=user, target_date=target_date)
        if not history:
            return []

        medications = await PrescriptionMedication.filter(prescription_id=history.id).order_by("id")
        return [
            med
            for med in medications
            if (med.start_date is None or med.start_date <= target_date)
            and (med.end_date is None or med.end_date >= target_date)
        ]

    async def build_daily_medication_entries(
        self,
        *,
        user: User,
        target_date: date,
    ) -> list[DailyPrescriptionMedication]:
        medications = await self.get_medications_for_date(user=user, target_date=target_date)
        entries: list[DailyPrescriptionMedication] = []
        for med in medications:
            schedule_times = med.schedule_times if isinstance(med.schedule_times, list) else []
            normalized_times = [str(value).strip() for value in schedule_times if str(value).strip()]
            if not normalized_times:
                normalized_times = [None]

            for schedule_time in normalized_times:
                entries.append(
                    DailyPrescriptionMedication(
                        drug_name=med.medication_name,
                        dose=med.dose,
                        frequency_per_day=med.frequency_per_day,
                        dosage_per_once=med.dosage_per_once,
                        intake_time=schedule_time,
                        dispensed_date=med.dispensed_date,
                        total_days=med.total_days,
                    )
                )
        return entries

    def _normalize_medication(self, med: dict[str, Any], *, fallback_date: date) -> dict[str, Any] | None:
        medication_name = str(med.get("drug_name") or "").strip()
        if not medication_name:
            return None

        schedule_times = self.reminder_service._extract_schedule_times(med)
        if not schedule_times:
            schedule_times = ["09:00"]

        dispensed_date = self.reminder_service._parse_date(med.get("dispensed_date")) or fallback_date
        total_days = self.reminder_service._parse_int(med.get("total_days"))
        if total_days is None or total_days <= 0:
            total_days = 1

        end_date = dispensed_date + timedelta(days=total_days - 1)

        return {
            "medication_name": medication_name,
            "dose": self._parse_float(med.get("dose")),
            "frequency_per_day": self.reminder_service._parse_int(med.get("frequency_per_day")),
            "dosage_per_once": self.reminder_service._parse_int(med.get("dosage_per_once")),
            "schedule_times": schedule_times,
            "administration_timing": self._parse_optional_str(med.get("administration_timing")),
            "dispensed_date": dispensed_date,
            "total_days": total_days,
            "start_date": dispensed_date,
            "end_date": end_date,
            "raw_payload": med,
        }

    @staticmethod
    def _parse_optional_str(value: Any) -> str | None:
        text = str(value or "").strip()
        return text or None

    @staticmethod
    def _parse_float(value: Any) -> float | None:
        if isinstance(value, bool):
            return None
        if isinstance(value, int | float):
            return float(value)
        if isinstance(value, str) and value.strip():
            try:
                return float(value.strip())
            except ValueError:
                return None
        return None
