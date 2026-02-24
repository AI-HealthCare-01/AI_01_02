from datetime import datetime
from pathlib import Path
from uuid import uuid4

from fastapi import HTTPException, UploadFile, status
from tortoise.transactions import in_transaction

from app.core import config, default_logger
from app.models.ocr import Document, DocumentType, OcrFailureCode, OcrJob, OcrJobStatus, OcrResult
from app.models.users import User
from app.repositories.ocr_repository import OcrRepository
from app.services.ocr_queue import OcrQueuePublisher


class OcrService:
    def __init__(self) -> None:
        self.repo = OcrRepository()
        self.queue_publisher = OcrQueuePublisher()

    async def upload_document(self, *, user: User, document_type: DocumentType, file: UploadFile) -> Document:
        if not file.filename:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="업로드 파일명이 필요합니다.")

        extension = Path(file.filename).suffix.lstrip(".").lower()
        if extension not in set(config.OCR_ALLOWED_EXTENSIONS):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="허용되지 않는 파일 형식입니다. (pdf, jpg, jpeg, png)",
            )

        content = await file.read()
        file_size = len(content)
        if file_size > config.OCR_MAX_FILE_SIZE_BYTES:
            raise HTTPException(status_code=status.HTTP_413_CONTENT_TOO_LARGE, detail="파일 크기 제한을 초과했습니다.")

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
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="파일 저장에 실패했습니다."
            ) from err

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
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="문서를 찾을 수 없습니다.")

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
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="OCR 작업 큐 등록에 실패했습니다. 잠시 후 다시 시도해주세요.",
            ) from err

        return job

    async def get_ocr_job(self, *, user: User, job_id: int) -> OcrJob:
        job = await self.repo.get_user_job(job_id=job_id, user_id=user.id)
        if not job:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="OCR 작업을 찾을 수 없습니다.")
        return job

    async def get_ocr_result(self, *, user: User, job_id: int) -> OcrResult:
        job = await self.get_ocr_job(user=user, job_id=job_id)
        if job.status != OcrJobStatus.SUCCEEDED:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="OCR 작업이 아직 완료되지 않았습니다.")

        result = await OcrResult.get_or_none(job_id=job.id)
        if not result:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="OCR 결과를 찾을 수 없습니다.")
        return result
