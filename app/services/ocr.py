import asyncio
from datetime import datetime
from pathlib import Path
from uuid import uuid4

from fastapi import HTTPException, UploadFile, status
from tortoise.transactions import in_transaction

from app.core import config, default_logger
from app.models.ocr import Document, DocumentType, OcrFailureCode, OcrJob, OcrJobStatus
from app.models.users import User
from app.dtos.ocr import OcrResultConfirmRequest
from app.repositories.ocr_repository import OcrRepository
from app.services.ai_ocr import call_clova_ocr, parse_ocr_with_openai
from app.services.guide_automation import GuideAutomationService
from app.services.ocr_queue import OcrQueuePublisher


class OcrService:
    def __init__(self) -> None:
        self.repo = OcrRepository()
        self.queue_publisher = OcrQueuePublisher()
        self.guide_automation_service = GuideAutomationService()

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

        # Run OCR processing in background so the HTTP response returns immediately.
        # The frontend polls GET /ocr/jobs/{id} until status changes to SUCCEEDED/FAILED.
        asyncio.create_task(self._process_job_locally(job.id, document.temp_storage_key))

        return job

    async def _process_job_locally(self, job_id: int, temp_storage_key: str) -> None:
        """Run Clova OCR + OpenAI parsing. Designed to run as a background task."""
        file_path = Path(config.MEDIA_DIR).resolve() / temp_storage_key
        try:
            started_at = datetime.now(config.TIMEZONE)
            await OcrJob.filter(id=job_id).update(status=OcrJobStatus.PROCESSING, started_at=started_at)

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
                completed_at=datetime.now(config.TIMEZONE),
            )
        except Exception as err:
            default_logger.exception("ocr local processing failed (job_id=%s)", job_id)
            try:
                await OcrJob.filter(id=job_id).update(
                    status=OcrJobStatus.FAILED,
                    failure_code=OcrFailureCode.PROCESSING_ERROR,
                    error_message=f"[PROCESSING_ERROR] {err}"[:1000],
                    completed_at=datetime.now(config.TIMEZONE),
                )
            except Exception:
                default_logger.exception("failed to mark ocr job as FAILED (job_id=%s)", job_id)
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

        structured_data = job.confirmed_result if isinstance(job.confirmed_result, dict) else {}
        if not structured_data:
            structured_data = job.structured_result if isinstance(job.structured_result, dict) else {}

        return {
            "job_id": str(job.id),
            "extracted_text": job.raw_text or "",
            "structured_data": structured_data,
            "created_at": job.created_at,
            "updated_at": job.updated_at,
        }

    async def confirm_ocr_review(
        self,
        *,
        user: User,
        job_id: int,
        confirmed: bool,
        corrected_medications: list[dict],
        comment: str | None,
    ) -> OcrJob:
        job = await self.get_ocr_job(user=user, job_id=job_id)
        if job.status != OcrJobStatus.SUCCEEDED:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="OCR 작업이 아직 완료되지 않았습니다.")

        base_result = job.confirmed_result if isinstance(job.confirmed_result, dict) else {}
        if not base_result:
            base_result = job.structured_result if isinstance(job.structured_result, dict) else {}

        confirmed_result = dict(base_result)
        if corrected_medications:
            confirmed_result["extracted_medications"] = corrected_medications
        confirmed_result["user_confirmed"] = confirmed
        if comment:
            confirmed_result["user_comment"] = comment
        confirmed_result["needs_user_review"] = not confirmed

        updated_job = await self.repo.update_job_confirm(
            job_id=job.id,
            user_id=user.id,
            confirmed_result=confirmed_result,
            needs_user_review=not confirmed,
        )
        if not updated_job:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="OCR 작업을 찾을 수 없습니다.")

        await self.guide_automation_service.trigger_refresh_for_ocr_job(
            user_id=user.id,
            ocr_job_id=updated_job.id,
            reason="ocr_review_corrected",
        )
        return updated_job

    async def confirm_ocr_result(self, *, user: User, job_id: int, request: OcrResultConfirmRequest) -> OcrJob:
        job = await self.get_ocr_job(user=user, job_id=job_id)
        if job.status != OcrJobStatus.SUCCEEDED:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="OCR 작업이 아직 완료되지 않았습니다.")

        existing_confirmed = job.confirmed_result if isinstance(job.confirmed_result, dict) else {}
        confirmed_payload = {
            "raw_text": request.raw_text,
            "extracted_medications": [item.model_dump() for item in request.extracted_medications],
            "confirmed_at": datetime.now(config.TIMEZONE).isoformat(),
            "confirmed_by_user_id": user.id,
        }
        merged_confirmed = {
            **existing_confirmed,
            "confirmed_ocr": confirmed_payload,
            "extracted_medications": confirmed_payload["extracted_medications"],
            "needs_user_review": False,
        }

        updated_job = await self.repo.update_job_confirm(
            job_id=job.id,
            user_id=user.id,
            confirmed_result=merged_confirmed,
            needs_user_review=False,
        )
        if not updated_job:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="OCR 작업을 찾을 수 없습니다.")

        await self.guide_automation_service.trigger_refresh_for_ocr_job(
            user_id=user.id,
            ocr_job_id=updated_job.id,
            reason="ocr_result_confirmed",
        )
        return updated_job
