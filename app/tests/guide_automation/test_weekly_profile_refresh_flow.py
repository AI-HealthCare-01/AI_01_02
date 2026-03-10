from datetime import datetime, timedelta
from unittest.mock import AsyncMock, patch

from tortoise.contrib.test import TestCase

from app.core import config
from app.models.guides import GuideJob, GuideJobStatus
from app.models.health_profiles import UserHealthProfile
from app.models.notifications import Notification, NotificationType
from app.models.ocr import Document, DocumentType, OcrJob, OcrJobStatus
from app.models.users import Gender, User
from app.services.guide_automation import GuideAutomationService


class TestWeeklyProfileRefreshFlow(TestCase):
    async def _create_user(self, *, email: str, phone_number: str) -> User:
        return await User.create(
            email=email,
            hashed_password="hashed-password",
            name="주간갱신테스터",
            gender=Gender.MALE,
            birthday="1990-01-01",
            phone_number=phone_number,
        )

    async def _create_succeeded_ocr_job(self, *, user: User, file_name: str = "ocr.png") -> OcrJob:
        document = await Document.create(
            user=user,
            document_type=DocumentType.PRESCRIPTION,
            file_name=file_name,
            temp_storage_key=f"documents/test/{file_name}",
            file_size=100,
            mime_type="image/png",
        )
        return await OcrJob.create(user=user, document=document, status=OcrJobStatus.SUCCEEDED)

    async def _create_profile(self, *, user: User, updated_at: datetime) -> UserHealthProfile:
        profile = await UserHealthProfile.create(
            user=user,
            height_cm=175.0,
            weight_kg=70.0,
            drug_allergies=["페니실린"],
            exercise_frequency_per_week=2,
            pc_hours_per_day=5,
            smartphone_hours_per_day=3,
            caffeine_cups_per_day=2,
            smoking=0,
            alcohol_frequency_per_week=1,
            bed_time="23:00",
            wake_time="07:00",
            sleep_latency_minutes=20,
            night_awakenings_per_week=1,
            daytime_sleepiness=3,
            appetite_level=6,
            meal_regular=True,
            bmi=22.86,
            sleep_time_hours=8.0,
            caffeine_mg=200,
            digital_time_hours=8,
            weekly_refresh_weekday=None,
            weekly_refresh_time=None,
            weekly_adherence_rate=90.0,
            onboarding_completed_at=updated_at,
        )
        await UserHealthProfile.filter(id=profile.id).update(updated_at=updated_at)
        await profile.refresh_from_db()
        return profile

    async def _create_succeeded_guide(self, *, user: User, ocr_job: OcrJob, completed_at: datetime) -> GuideJob:
        return await GuideJob.create(
            user=user,
            ocr_job=ocr_job,
            status=GuideJobStatus.SUCCEEDED,
            completed_at=completed_at,
        )

    async def test_requires_profile_refresh_when_guide_older_than_7_days(self):
        service = GuideAutomationService()
        user = await self._create_user(email="weekly_required@example.com", phone_number="01085008500")
        now = datetime.now(config.TIMEZONE)
        old_profile_time = now - timedelta(days=10)
        old_guide_time = now - timedelta(days=8)

        await self._create_profile(user=user, updated_at=old_profile_time)
        guide_ocr = await self._create_succeeded_ocr_job(user=user, file_name="old-guide.png")
        guide = await self._create_succeeded_guide(user=user, ocr_job=guide_ocr, completed_at=old_guide_time)

        required, source_guide_job_id = await service.is_profile_refresh_required_for_guide_generation(user_id=user.id)
        assert required is True
        assert source_guide_job_id == guide.id

    async def test_ocr_change_triggers_guide_after_profile_updated(self):
        service = GuideAutomationService()
        user = await self._create_user(email="weekly_updated@example.com", phone_number="01085008501")
        now = datetime.now(config.TIMEZONE)
        old_profile_time = now - timedelta(days=10)
        old_guide_time = now - timedelta(days=8)

        profile = await self._create_profile(user=user, updated_at=old_profile_time)
        old_ocr = await self._create_succeeded_ocr_job(user=user, file_name="old-guide2.png")
        await self._create_succeeded_guide(user=user, ocr_job=old_ocr, completed_at=old_guide_time)

        # 프로필을 최신으로 갱신하면 7일 경과 가이드라도 재생성 허용
        await UserHealthProfile.filter(id=profile.id).update(updated_at=now)
        new_ocr = await self._create_succeeded_ocr_job(user=user, file_name="new-prescription.png")

        with patch("app.services.guide_automation.GuideQueuePublisher.enqueue_job", new=AsyncMock(return_value=None)):
            job = await service.trigger_refresh_for_ocr_job(
                user_id=user.id,
                ocr_job_id=new_ocr.id,
                reason="ocr_result_confirmed",
            )

        assert job is not None
        assert job.status == GuideJobStatus.QUEUED

    async def test_ocr_change_is_blocked_and_notifies_when_profile_not_refreshed(self):
        service = GuideAutomationService()
        user = await self._create_user(email="weekly_blocked@example.com", phone_number="01085008502")
        now = datetime.now(config.TIMEZONE)
        old_profile_time = now - timedelta(days=10)
        old_guide_time = now - timedelta(days=8)

        await self._create_profile(user=user, updated_at=old_profile_time)
        old_ocr = await self._create_succeeded_ocr_job(user=user, file_name="old-guide3.png")
        await self._create_succeeded_guide(user=user, ocr_job=old_ocr, completed_at=old_guide_time)
        new_ocr = await self._create_succeeded_ocr_job(user=user, file_name="new-prescription2.png")

        with patch("app.services.guide_automation.GuideQueuePublisher.enqueue_job", new=AsyncMock(return_value=None)):
            job = await service.trigger_refresh_for_ocr_job(
                user_id=user.id,
                ocr_job_id=new_ocr.id,
                reason="ocr_result_confirmed",
            )

        assert job is None
        assert await GuideJob.filter(user_id=user.id, ocr_job_id=new_ocr.id).count() == 0
        alerts = await Notification.filter(user_id=user.id, type=NotificationType.HEALTH_ALERT).all()
        assert any(
            isinstance(alert.payload, dict) and alert.payload.get("event") == "guide_weekly_refresh_required"
            for alert in alerts
        )
