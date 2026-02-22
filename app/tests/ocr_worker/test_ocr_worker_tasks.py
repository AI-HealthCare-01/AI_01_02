from pathlib import Path
from tempfile import TemporaryDirectory
from unittest.mock import Mock, patch

from tortoise.contrib.test import TestCase

from ai_worker.tasks.ocr import compute_retry_delay_seconds, process_ocr_job
from app.models.ocr import Document, DocumentType, OcrFailureCode, OcrJob, OcrJobStatus, OcrResult
from app.models.users import Gender, User


class TestOcrWorkerTasks(TestCase):
    async def _create_user(self, *, email: str, phone_number: str) -> User:
        return await User.create(
            email=email,
            hashed_password="hashed-password",
            name="워커테스터",
            gender=Gender.MALE,
            birthday="1990-01-01",
            phone_number=phone_number,
        )

    async def test_process_ocr_job_success(self):
        user = await self._create_user(email="worker_success@example.com", phone_number="01082108210")
        logger = Mock()
        scheduled_retries: list[tuple[int, int]] = []
        dead_letters: list[dict] = []

        async def _schedule_retry(job_id: int, retry_count: int) -> None:
            scheduled_retries.append((job_id, retry_count))

        async def _dead_letter(payload: dict) -> None:
            dead_letters.append(payload)

        with TemporaryDirectory() as tmp_dir:
            media_dir = Path(tmp_dir)
            relative_file_path = "documents/worker/success.png"
            absolute_file_path = media_dir / relative_file_path
            absolute_file_path.parent.mkdir(parents=True, exist_ok=True)
            absolute_file_path.write_bytes(b"worker-ocr-content")

            document = await Document.create(
                user=user,
                document_type=DocumentType.PRESCRIPTION,
                file_name="success.png",
                file_path=relative_file_path,
                file_size=len(b"worker-ocr-content"),
                mime_type="image/png",
            )
            job = await OcrJob.create(user=user, document=document)

            with patch("ai_worker.tasks.ocr.config.MEDIA_DIR", str(media_dir)):
                processed = await process_ocr_job(
                    job_id=job.id,
                    logger=logger,
                    schedule_retry=_schedule_retry,
                    send_to_dead_letter=_dead_letter,
                )

        await job.refresh_from_db()
        result = await OcrResult.get(job_id=job.id)
        assert processed is True
        assert job.status == OcrJobStatus.SUCCEEDED
        assert job.retry_count == 0
        assert job.failure_code is None
        assert result.job_id == job.id
        assert "success.png" in result.extracted_text
        assert scheduled_retries == []
        assert dead_letters == []

    async def test_process_ocr_job_missing_file_retries_then_fails(self):
        user = await self._create_user(email="worker_failed@example.com", phone_number="01082108211")
        logger = Mock()
        scheduled_retries: list[tuple[int, int]] = []
        dead_letters: list[dict] = []

        async def _schedule_retry(job_id: int, retry_count: int) -> None:
            scheduled_retries.append((job_id, retry_count))

        async def _dead_letter(payload: dict) -> None:
            dead_letters.append(payload)

        with TemporaryDirectory() as tmp_dir:
            media_dir = Path(tmp_dir)
            document = await Document.create(
                user=user,
                document_type=DocumentType.MEDICAL_RECORD,
                file_name="missing.pdf",
                file_path="documents/worker/missing.pdf",
                file_size=10,
                mime_type="application/pdf",
            )
            job = await OcrJob.create(user=user, document=document, max_retries=2)

            with patch("ai_worker.tasks.ocr.config.MEDIA_DIR", str(media_dir)):
                first_processed = await process_ocr_job(
                    job_id=job.id,
                    logger=logger,
                    schedule_retry=_schedule_retry,
                    send_to_dead_letter=_dead_letter,
                )
                await job.refresh_from_db()
                assert first_processed is True
                assert job.status == OcrJobStatus.QUEUED
                assert job.retry_count == 1
                assert job.failure_code == OcrFailureCode.FILE_NOT_FOUND
                assert (job.error_message or "").startswith(f"[{OcrFailureCode.FILE_NOT_FOUND.value}]")

                second_processed = await process_ocr_job(
                    job_id=job.id,
                    logger=logger,
                    schedule_retry=_schedule_retry,
                    send_to_dead_letter=_dead_letter,
                )

        await job.refresh_from_db()
        assert second_processed is True
        assert job.status == OcrJobStatus.FAILED
        assert job.retry_count == 2
        assert job.failure_code == OcrFailureCode.FILE_NOT_FOUND
        assert "not found" in (job.error_message or "")
        assert scheduled_retries == [(job.id, 1)]
        assert len(dead_letters) == 1
        assert dead_letters[0]["job_id"] == job.id
        assert dead_letters[0]["failure_code"] == OcrFailureCode.FILE_NOT_FOUND.value
        assert dead_letters[0]["retry_count"] == 2
        assert dead_letters[0]["max_retries"] == 2

    async def test_process_ocr_job_skips_non_queued_job(self):
        user = await self._create_user(email="worker_skipped@example.com", phone_number="01082108212")
        logger = Mock()
        scheduled_retries: list[tuple[int, int]] = []
        dead_letters: list[dict] = []

        async def _schedule_retry(job_id: int, retry_count: int) -> None:
            scheduled_retries.append((job_id, retry_count))

        async def _dead_letter(payload: dict) -> None:
            dead_letters.append(payload)

        with TemporaryDirectory() as tmp_dir:
            media_dir = Path(tmp_dir)
            document = await Document.create(
                user=user,
                document_type=DocumentType.PRESCRIPTION,
                file_name="skipped.png",
                file_path="documents/worker/skipped.png",
                file_size=1,
                mime_type="image/png",
            )
            job = await OcrJob.create(user=user, document=document, status=OcrJobStatus.SUCCEEDED)

            with patch("ai_worker.tasks.ocr.config.MEDIA_DIR", str(media_dir)):
                processed = await process_ocr_job(
                    job_id=job.id,
                    logger=logger,
                    schedule_retry=_schedule_retry,
                    send_to_dead_letter=_dead_letter,
                )

        await job.refresh_from_db()
        assert processed is True
        assert job.status == OcrJobStatus.SUCCEEDED
        assert scheduled_retries == []
        assert dead_letters == []

    async def test_retry_backoff_delay_calculation(self):
        with (
            patch("ai_worker.tasks.ocr.config.OCR_RETRY_BACKOFF_BASE_SECONDS", 2),
            patch("ai_worker.tasks.ocr.config.OCR_RETRY_BACKOFF_MAX_SECONDS", 10),
        ):
            assert compute_retry_delay_seconds(1) == 2
            assert compute_retry_delay_seconds(2) == 4
            assert compute_retry_delay_seconds(3) == 8
            assert compute_retry_delay_seconds(4) == 10
