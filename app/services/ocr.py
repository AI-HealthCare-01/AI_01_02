from pathlib import Path
from uuid import uuid4

from fastapi import UploadFile
from tortoise.transactions import in_transaction

from app.core import config, default_logger
from app.core.exceptions import AppException, ErrorCode
from app.models.ocr import Document, DocumentType, OcrFailureCode, OcrJob, OcrJobStatus
from app.models.users import User
from app.repositories.ocr_repository import OcrRepository
from app.services.ocr_queue import OcrQueuePublisher


class OcrService:
    def __init__(self) -> None:
        self.repo = OcrRepository()
        self.queue_publisher = OcrQueuePublisher()

    async def upload_document(self, *, user: User, document_type: DocumentType, file: UploadFile) -> Document:
        if not file.filename:
            raise AppException(ErrorCode.VALIDATION_ERROR, developer_message="업로드 파일명이 필요합니다.")

        extension = Path(file.filename).suffix.lstrip(".").lower()
        if extension not in set(config.OCR_ALLOWED_EXTENSIONS):
            raise AppException(ErrorCode.FILE_INVALID_TYPE)

        content = await file.read()
        file_size = len(content)
        if file_size > config.OCR_MAX_FILE_SIZE_BYTES:
            raise AppException(ErrorCode.FILE_TOO_LARGE)

        media_root = Path(config.MEDIA_DIR).resolve()
        user_dir = media_root / "documents" / str(user.id)
        user_dir.mkdir(parents=True, exist_ok=True)

        safe_file_name = Path(file.filename).name
        stored_file_name = f"{uuid4().hex}_{safe_file_name}"
        target_path = user_dir / stored_file_name
        temp_storage_key = target_path.relative_to(media_root).as_posix()

        try:
            target_path.write_bytes(content)
        except OSError as err:
            raise AppException(ErrorCode.INTERNAL_ERROR, developer_message="파일 저장에 실패했습니다.") from err

        try:
            async with in_transaction():
                document = await self.repo.create_document(
                    user_id=user.id,
                    document_type=document_type,
                    file_name=safe_file_name,
                    temp_storage_key=temp_storage_key,
                    file_size=file_size,
                    mime_type=file.content_type or "application/octet-stream",
                )
            return document
        except AppException:
            target_path.unlink(missing_ok=True)
            raise
        except Exception:
            target_path.unlink(missing_ok=True)
            raise

    def _dispose_uploaded_document_file(self, *, temp_storage_key: str, job_id: int) -> None:
        from datetime import datetime  # noqa: PLC0415

        absolute_file_path = Path(config.MEDIA_DIR).resolve() / temp_storage_key
        try:
            absolute_file_path.unlink(missing_ok=True)
        except OSError:
            default_logger.warning(
                "failed to dispose raw ocr file on queue failure (job_id=%s path=%s)", job_id, absolute_file_path
            )
            return
        # REQ-126: 폐기 시각 기록
        import asyncio  # noqa: PLC0415

        async def _mark_disposed() -> None:
            from app.models.ocr import Document  # noqa: PLC0415

            job = await OcrJob.get_or_none(id=job_id)
            if job:
                await Document.filter(id=job.document_id).update(disposed_at=datetime.now(config.TIMEZONE))

        try:
            loop = asyncio.get_running_loop()
            if loop.is_running():
                loop.create_task(_mark_disposed())
        except RuntimeError:
            pass

    async def create_ocr_job(self, *, user: User, document_id: int) -> OcrJob:
        document = await self.repo.get_user_document(document_id=document_id, user_id=user.id)
        if not document:
            raise AppException(ErrorCode.RESOURCE_NOT_FOUND, developer_message="문서를 찾을 수 없습니다.")

        async with in_transaction():
            job = await self.repo.create_job(
                user_id=user.id,
                document_id=document.id,
                max_retries=config.OCR_JOB_MAX_RETRIES,
            )

        try:
            await self.queue_publisher.enqueue_job(job.id)
        except RuntimeError as err:
            from datetime import datetime  # noqa: PLC0415

            await OcrJob.filter(id=job.id, status=OcrJobStatus.QUEUED).update(
                status=OcrJobStatus.FAILED,
                failure_code=OcrFailureCode.PROCESSING_ERROR,
                error_message="[PROCESSING_ERROR] OCR queue publish failed.",
                completed_at=datetime.now(config.TIMEZONE),
            )
            self._dispose_uploaded_document_file(temp_storage_key=document.temp_storage_key, job_id=job.id)
            default_logger.exception("ocr queue publish failed (job_id=%s)", job.id)
            raise AppException(
                ErrorCode.OCR_QUEUE_UNAVAILABLE, developer_message="OCR 작업 큐 등록에 실패했습니다."
            ) from err

        return job

    async def get_ocr_job(self, *, user: User, job_id: int) -> OcrJob:
        job = await self.repo.get_user_job(job_id=job_id, user_id=user.id)
        if not job:
            raise AppException(ErrorCode.RESOURCE_NOT_FOUND, developer_message="OCR 작업을 찾을 수 없습니다.")
        return job

    async def get_ocr_result(self, *, user: User, job_id: int) -> dict:
        job = await self.get_ocr_job(user=user, job_id=job_id)
        if job.status != OcrJobStatus.SUCCEEDED:
            raise AppException(ErrorCode.STATE_CONFLICT, developer_message="OCR 작업이 아직 완료되지 않았습니다.")

        return {
            "job_id": str(job.id),
            "extracted_text": job.raw_text or "",
            "structured_data": job.structured_result or {},
            "created_at": job.created_at,
            "updated_at": job.updated_at,
        }

    async def confirm_ocr_result(
        self,
        *,
        user: User,
        job_id: int,
        confirmed: bool,
        corrected_medications: list[dict] | None,
        comment: str | None,
    ) -> OcrJob:
        job = await self.get_ocr_job(user=user, job_id=job_id)
        if job.status != OcrJobStatus.SUCCEEDED:
            raise AppException(ErrorCode.STATE_CONFLICT, developer_message="OCR 작업이 아직 완료되지 않았습니다.")

        confirmed_result = dict(job.structured_result or {})
        if confirmed and corrected_medications is not None:
            confirmed_result["extracted_medications"] = corrected_medications
        if comment:
            confirmed_result["user_comment"] = comment

        updated_job = await self.repo.update_job_confirm(
            job_id=job.id,
            user_id=user.id,
            confirmed_result=confirmed_result,
            needs_user_review=not confirmed,
        )
        if not updated_job:
            raise AppException(ErrorCode.RESOURCE_NOT_FOUND, developer_message="OCR 작업을 찾을 수 없습니다.")
        return updated_job
