from unittest.mock import Mock, patch

from tortoise.contrib.test import TestCase

from ai_worker.tasks.guide import GUIDE_SAFETY_NOTICE, compute_retry_delay_seconds, process_guide_job
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
        scheduled_retries: list[tuple[int, int]] = []
        dead_letters: list[dict] = []

        async def _schedule_retry(job_id: int, retry_count: int) -> None:
            scheduled_retries.append((job_id, retry_count))

        async def _dead_letter(payload: dict) -> None:
            dead_letters.append(payload)

        ocr_job = await self._create_ocr_job(user=user, status=OcrJobStatus.SUCCEEDED)
        await OcrResult.create(
            job=ocr_job,
            extracted_text="복약 관련 OCR 텍스트",
            structured_data={"summary": "ok"},
        )
        guide_job = await GuideJob.create(user=user, ocr_job=ocr_job)

        processed = await process_guide_job(
            job_id=guide_job.id,
            logger=logger,
            schedule_retry=_schedule_retry,
            send_to_dead_letter=_dead_letter,
        )

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
        assert scheduled_retries == []
        assert dead_letters == []

    async def test_process_guide_job_ocr_not_ready_retries(self):
        user = await self._create_user(email="guide_worker_not_ready@example.com", phone_number="01084008401")
        logger = Mock()
        scheduled_retries: list[tuple[int, int]] = []
        dead_letters: list[dict] = []

        async def _schedule_retry(job_id: int, retry_count: int) -> None:
            scheduled_retries.append((job_id, retry_count))

        async def _dead_letter(payload: dict) -> None:
            dead_letters.append(payload)

        ocr_job = await self._create_ocr_job(user=user, status=OcrJobStatus.QUEUED)
        guide_job = await GuideJob.create(user=user, ocr_job=ocr_job, max_retries=2)

        processed = await process_guide_job(
            job_id=guide_job.id,
            logger=logger,
            schedule_retry=_schedule_retry,
            send_to_dead_letter=_dead_letter,
        )

        await guide_job.refresh_from_db()
        assert processed is True
        assert guide_job.status == GuideJobStatus.QUEUED
        assert guide_job.retry_count == 1
        assert guide_job.failure_code == GuideFailureCode.OCR_NOT_READY
        assert "OCR job not ready" in (guide_job.error_message or "")
        assert await Notification.filter(user_id=user.id, type=NotificationType.GUIDE_READY).count() == 0
        assert scheduled_retries == [(guide_job.id, 1)]
        assert dead_letters == []

    async def test_process_guide_job_retry_exhausted_marks_failed(self):
        user = await self._create_user(email="guide_worker_retry_exhausted@example.com", phone_number="01084008403")
        logger = Mock()
        scheduled_retries: list[tuple[int, int]] = []
        dead_letters: list[dict] = []

        async def _schedule_retry(job_id: int, retry_count: int) -> None:
            scheduled_retries.append((job_id, retry_count))

        async def _dead_letter(payload: dict) -> None:
            dead_letters.append(payload)

        ocr_job = await self._create_ocr_job(user=user, status=OcrJobStatus.QUEUED)
        guide_job = await GuideJob.create(user=user, ocr_job=ocr_job, max_retries=1)

        processed = await process_guide_job(
            job_id=guide_job.id,
            logger=logger,
            schedule_retry=_schedule_retry,
            send_to_dead_letter=_dead_letter,
        )

        await guide_job.refresh_from_db()
        assert processed is True
        assert guide_job.status == GuideJobStatus.FAILED
        assert guide_job.retry_count == 1
        assert guide_job.failure_code == GuideFailureCode.OCR_NOT_READY
        assert (guide_job.error_message or "").startswith(f"[{GuideFailureCode.OCR_NOT_READY.value}]")
        assert guide_job.completed_at is not None
        assert scheduled_retries == []
        assert len(dead_letters) == 1
        assert dead_letters[0]["job_id"] == guide_job.id
        assert dead_letters[0]["failure_code"] == GuideFailureCode.OCR_NOT_READY.value
        assert dead_letters[0]["retry_count"] == 1
        assert dead_letters[0]["max_retries"] == 1

    async def test_process_guide_job_skips_non_queued_job(self):
        user = await self._create_user(email="guide_worker_skip@example.com", phone_number="01084008402")
        logger = Mock()
        ocr_job = await self._create_ocr_job(user=user, status=OcrJobStatus.SUCCEEDED)
        guide_job = await GuideJob.create(user=user, ocr_job=ocr_job, status=GuideJobStatus.SUCCEEDED)

        processed = await process_guide_job(job_id=guide_job.id, logger=logger)

        await guide_job.refresh_from_db()
        assert processed is True
        assert guide_job.status == GuideJobStatus.SUCCEEDED

    async def test_retry_backoff_delay_calculation(self):
        with (
            patch("ai_worker.tasks.guide.config.GUIDE_RETRY_BACKOFF_BASE_SECONDS", 2),
            patch("ai_worker.tasks.guide.config.GUIDE_RETRY_BACKOFF_MAX_SECONDS", 10),
        ):
            assert compute_retry_delay_seconds(1) == 2
            assert compute_retry_delay_seconds(2) == 4
            assert compute_retry_delay_seconds(3) == 8
            assert compute_retry_delay_seconds(4) == 10
