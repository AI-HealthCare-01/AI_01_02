from datetime import date

from tortoise.contrib.test import TestCase

from app.dtos.ocr import ExtractedMedication, OcrResultConfirmRequest
from app.models.ocr import Document, DocumentType, OcrJob, OcrJobStatus
from app.models.prescriptions import PrescriptionHistory, PrescriptionMedication
from app.models.reminders import ScheduleItemCategory
from app.models.users import Gender, User
from app.services.ocr import OcrService
from app.services.schedules import ScheduleService


class TestPrescriptionHistorySchedule(TestCase):
    async def _create_user(self, *, email: str) -> User:
        return await User.create(
            email=email,
            hashed_password="hashed",
            name="테스터",
            gender=Gender.MALE,
            birthday=date(1990, 1, 1),
            phone_number="01012345678",
        )

    async def test_confirm_ocr_result_creates_prescription_history_snapshot(self):
        user = await self._create_user(email="schedule_history_ocr@example.com")
        document = await Document.create(
            user_id=user.id,
            document_type=DocumentType.PRESCRIPTION,
            file_name="test.png",
            temp_storage_key="documents/test.png",
            file_size=10,
            mime_type="image/png",
        )
        job = await OcrJob.create(
            user_id=user.id,
            document_id=document.id,
            status=OcrJobStatus.SUCCEEDED,
            confirmed_result={},
        )

        service = OcrService()
        await service.confirm_ocr_result(
            user=user,
            job_id=job.id,
            request=OcrResultConfirmRequest(
                raw_text="처방전 원문",
                extracted_medications=[
                    ExtractedMedication(
                        drug_name="콘서타",
                        dose=18,
                        frequency_per_day=1,
                        dosage_per_once=1,
                        intake_time=["morning"],
                        administration_timing="아침 식후",
                        dispensed_date="2026-03-02",
                        total_days=10,
                        side_effect="식욕 저하",
                    )
                ],
            ),
        )

        history = await PrescriptionHistory.get(source_ocr_job_id=job.id)
        medications = await PrescriptionMedication.filter(prescription_id=history.id)

        assert history.user_id == user.id
        assert history.prescribed_date == date(2026, 3, 2)
        assert history.start_date == date(2026, 3, 2)
        assert history.end_date == date(2026, 3, 11)
        assert history.days_supply == 10
        assert len(medications) == 1
        assert medications[0].medication_name == "콘서타"
        assert medications[0].schedule_times == ["08:00"]

    async def test_daily_schedule_uses_prescription_history_for_target_date(self):
        user = await self._create_user(email="schedule_history_dates@example.com")

        history1 = await PrescriptionHistory.create(
            user_id=user.id,
            source_ocr_job_id=101,
            prescribed_date=date(2026, 3, 2),
            days_supply=10,
            start_date=date(2026, 3, 2),
            end_date=date(2026, 3, 11),
        )
        await PrescriptionMedication.create(
            prescription_id=history1.id,
            medication_name="콘서타",
            dose=18,
            frequency_per_day=1,
            dosage_per_once=1,
            schedule_times=["08:00"],
            administration_timing="아침 식후",
            dispensed_date=date(2026, 3, 2),
            total_days=10,
            start_date=date(2026, 3, 2),
            end_date=date(2026, 3, 11),
            raw_payload={"drug_name": "콘서타"},
        )

        history2 = await PrescriptionHistory.create(
            user_id=user.id,
            source_ocr_job_id=102,
            prescribed_date=date(2026, 3, 15),
            days_supply=10,
            start_date=date(2026, 3, 15),
            end_date=date(2026, 3, 24),
        )
        await PrescriptionMedication.create(
            prescription_id=history2.id,
            medication_name="메틸페니데이트",
            dose=27,
            frequency_per_day=1,
            dosage_per_once=1,
            schedule_times=["09:00"],
            administration_timing="아침 식후",
            dispensed_date=date(2026, 3, 15),
            total_days=10,
            start_date=date(2026, 3, 15),
            end_date=date(2026, 3, 24),
            raw_payload={"drug_name": "메틸페니데이트"},
        )

        service = ScheduleService()

        items_before, meds_before = await service.get_daily_schedule(
            user=user,
            target_date=date(2026, 3, 1),
            timezone=None,
        )
        items_during, meds_during = await service.get_daily_schedule(
            user=user,
            target_date=date(2026, 3, 5),
            timezone=None,
        )
        items_after, meds_after = await service.get_daily_schedule(
            user=user,
            target_date=date(2026, 3, 12),
            timezone=None,
        )
        items_latest, meds_latest = await service.get_daily_schedule(
            user=user,
            target_date=date(2026, 3, 16),
            timezone=None,
        )

        medication_items_before = [item for item in items_before if item.category == ScheduleItemCategory.MEDICATION]
        medication_items_during = [item for item in items_during if item.category == ScheduleItemCategory.MEDICATION]
        medication_items_after = [item for item in items_after if item.category == ScheduleItemCategory.MEDICATION]
        medication_items_latest = [item for item in items_latest if item.category == ScheduleItemCategory.MEDICATION]

        assert medication_items_before == []
        assert meds_before == []

        assert len(medication_items_during) == 1
        assert medication_items_during[0].medication_name == "콘서타"
        assert [med.drug_name for med in meds_during] == ["콘서타"]

        assert medication_items_after == []
        assert meds_after == []

        assert len(medication_items_latest) == 1
        assert medication_items_latest[0].medication_name == "메틸페니데이트"
        assert [med.drug_name for med in meds_latest] == ["메틸페니데이트"]
