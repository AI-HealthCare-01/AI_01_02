from datetime import datetime
from pathlib import Path
from uuid import uuid4

from fastapi import HTTPException, UploadFile, status
from tortoise.transactions import in_transaction

from app.core import config, default_logger
from app.models.ocr import Document, DocumentType, OcrFailureCode, OcrJob, OcrJobStatus
from app.models.users import User
from app.repositories.ocr_repository import OcrRepository
from app.services.ai_ocr import call_clova_ocr, parse_ocr_with_openai
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
        temp_storage_key = target_path.relative_to(media_root).as_posix()

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
                    temp_storage_key=temp_storage_key,
                    file_size=file_size,
                    mime_type=file.content_type or "application/octet-stream",
                )
            return document
        except Exception:
            target_path.unlink(missing_ok=True)
            raise

    def _dispose_uploaded_document_file(self, *, temp_storage_key: str, job_id: int) -> None:
        absolute_file_path = Path(config.MEDIA_DIR).resolve() / temp_storage_key
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
            # For immediate response in a real testing block, we do synchronous queue bypass here 
            # (In production, this is done by a background worker handling Redis queue)
            # await self.queue_publisher.enqueue_job(job.id)
            await self._process_job_locally(job.id, document.temp_storage_key)
        except Exception as err:
            failed_at = datetime.now(config.TIMEZONE)
            await OcrJob.filter(id=job.id, status=OcrJobStatus.QUEUED).update(
                status=OcrJobStatus.FAILED,
                failure_code=OcrFailureCode.PROCESSING_ERROR,
                error_message=f"[PROCESSING_ERROR] OCR queue publish or execution failed. {str(err)}",
                started_at=datetime.now(config.TIMEZONE),
                completed_at=failed_at,
            )
            self._dispose_uploaded_document_file(temp_storage_key=document.temp_storage_key, job_id=job.id)
            default_logger.exception("ocr queue publish failed (job_id=%s)", job.id)
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="OCR 작업 큐 등록/처리에 실패했습니다.",
            ) from err

        return job

    async def _process_job_locally(self, job_id: int, temp_storage_key: str) -> None:
        file_path = Path(config.MEDIA_DIR).resolve() / temp_storage_key
        # Update state to PROCESSING
        started_at = datetime.now(config.TIMEZONE)
        await OcrJob.filter(id=job_id).update(status=OcrJobStatus.PROCESSING, started_at=started_at)
        
        try: 
            clova_resp = await call_clova_ocr(file_path)
            raw_text = " ".join([
                field.get("inferText", "")
                for image in clova_resp.get("images", [])
                for field in image.get("fields", [])
            ])
            text_blocks_json = clova_resp.get("images", [{}])[0].get("fields", [])

            structured_result = await parse_ocr_with_openai(raw_text)

            await OcrJob.filter(id=job_id).update(
                status=OcrJobStatus.SUCCEEDED,
                raw_text=raw_text,
                text_blocks_json=text_blocks_json,
                structured_result=structured_result,
                needs_user_review=structured_result.get("needs_user_review", True),
                completed_at=datetime.now(config.TIMEZONE)
            )
        except Exception as err:
             await OcrJob.filter(id=job_id).update(
                status=OcrJobStatus.FAILED,
                error_message=str(err),
                completed_at=datetime.now(config.TIMEZONE)
             )
             raise err
        finally:
             self._dispose_uploaded_document_file(temp_storage_key=temp_storage_key, job_id=job_id)

    async def get_ocr_job(self, *, user: User, job_id: int) -> OcrJob:
        job = await self.repo.get_user_job(job_id=job_id, user_id=user.id)
        if not job:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="OCR 작업을 찾을 수 없습니다.")
        return job

    async def get_ocr_result(self, *, user: User, job_id: int) -> dict:
        job = await self.get_ocr_job(user=user, job_id=job_id)
        if job.status != OcrJobStatus.SUCCEEDED:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="OCR 작업이 아직 완료되지 않았습니다.")

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
        corrected_medications: list | None,
        comment: str | None
    ) -> dict:
        job = await self.get_ocr_job(user=user, job_id=job_id)
        if job.status != OcrJobStatus.SUCCEEDED:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="OCR 작업이 아직 완료되지 않았습니다.")
        
        confirmed_result = job.structured_result or {}
        if confirmed and corrected_medications is not None:
            confirmed_result["extracted_medications"] = [
                med.model_dump() for med in corrected_medications
            ]
        
        if comment:
            confirmed_result["user_comment"] = comment

        updated_job = await self.repo.update_job_confirm(
            job_id=job.id,
            user_id=user.id,
            confirmed_result=confirmed_result,
            needs_user_review=False if confirmed else True
        )
        if not updated_job:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="OCR 작업을 찾을 수 없습니다.")

        return {
            "raw_text": updated_job.raw_text or "",
            "raw_blocks": updated_job.text_blocks_json,
            "extracted_medications": confirmed_result.get("extracted_medications", []),
            "overall_confidence": None,
            "needs_user_review": updated_job.needs_user_review,
        }
