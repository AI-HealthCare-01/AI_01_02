from unittest.mock import Mock

from tortoise.contrib.test import TestCase

from ai_worker.tasks.guide import GUIDE_SAFETY_NOTICE, process_guide_job
from app.models.guides import GuideFailureCode, GuideJob, GuideJobStatus, GuideResult
from app.models.notifications import Notification, NotificationType
from app.models.ocr import Document, DocumentType, OcrJob, OcrJobStatus, OcrResult
from app.models.users import Gender, User


class TestGuideWorkerTasks(TestCase):
    async def _create_user(self, *, email: str, phone_number: str) -> User:
        return await User.create(
            email=email,
            hashed_password="hashed-password",
            name="가이드워커테스터",
            gender=Gender.MALE,
            birthday="1990-01-01",
            phone_number=phone_number,
        )

    async def _create_ocr_job(self, *, user: User, status: OcrJobStatus) -> OcrJob:
        document = await Document.create(
            user=user,
            document_type=DocumentType.PRESCRIPTION,
            file_name="guide_worker.png",
            file_path="documents/guide/guide_worker.png",
            file_size=100,
            mime_type="image/png",
        )
        return await OcrJob.create(user=user, document=document, status=status)

    async def test_process_guide_job_success(self):
        user = await self._create_user(email="guide_worker_success@example.com", phone_number="01084008400")
        logger = Mock()
        ocr_job = await self._create_ocr_job(user=user, status=OcrJobStatus.SUCCEEDED)
        await OcrResult.create(
            job=ocr_job,
            extracted_text="복약 관련 OCR 텍스트",
            structured_data={"summary": "ok"},
        )
        guide_job = await GuideJob.create(user=user, ocr_job=ocr_job)

        processed = await process_guide_job(job_id=guide_job.id, logger=logger)

        await guide_job.refresh_from_db()
        result = await GuideResult.get(job_id=guide_job.id)
        notification = await Notification.get(user_id=user.id, type=NotificationType.GUIDE_READY)
        assert processed is True
        assert guide_job.status == GuideJobStatus.SUCCEEDED
        assert guide_job.failure_code is None
        assert result.job_id == guide_job.id
        assert result.safety_notice == GUIDE_SAFETY_NOTICE
        assert result.structured_data["source_ocr_job_id"] == ocr_job.id
        assert notification.payload["event"] == "guide_ready"
        assert notification.payload["guide_job_id"] == guide_job.id
        assert notification.payload["ocr_job_id"] == ocr_job.id

    async def test_process_guide_job_ocr_not_ready(self):
        user = await self._create_user(email="guide_worker_not_ready@example.com", phone_number="01084008401")
        logger = Mock()
        ocr_job = await self._create_ocr_job(user=user, status=OcrJobStatus.QUEUED)
        guide_job = await GuideJob.create(user=user, ocr_job=ocr_job, max_retries=2)

        processed = await process_guide_job(job_id=guide_job.id, logger=logger)

        await guide_job.refresh_from_db()
        assert processed is True
        assert guide_job.status == GuideJobStatus.FAILED
        assert guide_job.retry_count == 1
        assert guide_job.failure_code == GuideFailureCode.OCR_NOT_READY
        assert "OCR job not ready" in (guide_job.error_message or "")
        assert await Notification.filter(user_id=user.id, type=NotificationType.GUIDE_READY).count() == 0

    async def test_process_guide_job_skips_non_queued_job(self):
        user = await self._create_user(email="guide_worker_skip@example.com", phone_number="01084008402")
        logger = Mock()
        ocr_job = await self._create_ocr_job(user=user, status=OcrJobStatus.SUCCEEDED)
        guide_job = await GuideJob.create(user=user, ocr_job=ocr_job, status=GuideJobStatus.SUCCEEDED)

        processed = await process_guide_job(job_id=guide_job.id, logger=logger)

        await guide_job.refresh_from_db()
        assert processed is True
        assert guide_job.status == GuideJobStatus.SUCCEEDED
