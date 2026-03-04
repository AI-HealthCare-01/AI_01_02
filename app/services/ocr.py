from datetime import datetime
from pathlib import Path
from uuid import uuid4

from fastapi import UploadFile
from tortoise.transactions import in_transaction

from app.core import config, default_logger
from app.core.exceptions import AppException, ErrorCode
from app.models.ocr import Document, DocumentType, OcrFailureCode, OcrJob, OcrJobStatus, OcrResult
from app.models.users import User
from app.dtos.ocr import OcrResultConfirmRequest
from app.repositories.ocr_repository import OcrRepository
from app.services.guide_automation import GuideAutomationService
from app.services.ocr_queue import OcrQueuePublisher


class OcrService:
    def __init__(self) -> None:
        self.repo = OcrRepository()
        self.queue_publisher = OcrQueuePublisher()
        self.guide_automation_service = GuideAutomationService()

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
        relative_path = target_path.relative_to(media_root).as_posix()

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
                    file_path=relative_path,
                    file_size=file_size,
                    mime_type=file.content_type or "application/octet-stream",
                )
            return document
        except Exception:
            target_path.unlink(missing_ok=True)
            raise

    def _dispose_uploaded_document_file(self, *, relative_path: str, job_id: int) -> None:
        absolute_file_path = Path(config.MEDIA_DIR).resolve() / relative_path
        try:
            absolute_file_path.unlink(missing_ok=True)
        except OSError:
            default_logger.warning(
                "failed to dispose raw ocr file on queue failure (job_id=%s path=%s)", job_id, absolute_file_path
            )

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
            failed_at = datetime.now(config.TIMEZONE)
            await OcrJob.filter(id=job.id, status=OcrJobStatus.QUEUED).update(
                status=OcrJobStatus.FAILED,
                failure_code=OcrFailureCode.PROCESSING_ERROR,
                error_message="[PROCESSING_ERROR] OCR queue publish failed.",
                completed_at=failed_at,
            )
            self._dispose_uploaded_document_file(relative_path=document.file_path, job_id=job.id)
            default_logger.exception("ocr queue publish failed (job_id=%s)", job.id)
            raise AppException(ErrorCode.OCR_QUEUE_UNAVAILABLE) from err

        return job

    async def get_ocr_job(self, *, user: User, job_id: int) -> OcrJob:
        job = await self.repo.get_user_job(job_id=job_id, user_id=user.id)
        if not job:
            raise AppException(ErrorCode.RESOURCE_NOT_FOUND, developer_message="OCR 작업을 찾을 수 없습니다.")
        return job

    async def get_ocr_result(self, *, user: User, job_id: int) -> OcrResult:
        job = await self.get_ocr_job(user=user, job_id=job_id)
        if job.status != OcrJobStatus.SUCCEEDED:
            raise AppException(ErrorCode.STATE_CONFLICT, developer_message="OCR 작업이 아직 완료되지 않았습니다.")

        result = await OcrResult.get_or_none(job_id=job.id)
        if not result:
            raise AppException(ErrorCode.RESOURCE_NOT_FOUND, developer_message="OCR 결과를 찾을 수 없습니다.")
        return result

    async def confirm_ocr_review(
        self,
        *,
        user: User,
        job_id: int,
        confirmed: bool,
        corrected_medications: list[dict],
        comment: str | None,
    ) -> OcrResult:
        result = await self.get_ocr_result(user=user, job_id=job_id)
        if corrected_medications:
            structured = dict(result.structured_data)
            structured["medications"] = corrected_medications
            structured["user_confirmed"] = confirmed
            if comment:
                structured["confirm_comment"] = comment
            result.structured_data = structured
            await result.save(update_fields=["structured_data", "updated_at"])
            await self.guide_automation_service.trigger_refresh_for_ocr_job(
                user_id=user.id,
                ocr_job_id=result.job_id,
                reason="ocr_review_corrected",
            )
        return result

    async def confirm_ocr_result(self, *, user: User, job_id: int, request: OcrResultConfirmRequest) -> OcrResult:
        job = await self.get_ocr_job(user=user, job_id=job_id)
        if job.status != OcrJobStatus.SUCCEEDED:
            raise AppException(ErrorCode.STATE_CONFLICT, developer_message="OCR 작업이 아직 완료되지 않았습니다.")

        existing = await OcrResult.get_or_none(job_id=job.id)
        existing_structured = existing.structured_data if existing else {}
        confirmed_payload = {
            "raw_text": request.raw_text,
            "extracted_medications": [item.model_dump() for item in request.extracted_medications],
            "confirmed_at": datetime.now(config.TIMEZONE).isoformat(),
            "confirmed_by_user_id": user.id,
        }
        merged_structured = {
            **existing_structured,
            "confirmed_ocr": confirmed_payload,
        }
        result = await self.repo.upsert_result(
            job_id=job.id,
            extracted_text=request.raw_text,
            structured_data=merged_structured,
        )
        await self.guide_automation_service.trigger_refresh_for_ocr_job(
            user_id=user.id,
            ocr_job_id=job.id,
            reason="ocr_result_confirmed",
        )
        return result
