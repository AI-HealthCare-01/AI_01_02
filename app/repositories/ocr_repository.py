from typing import Any

from app.models.ocr import Document, DocumentType, OcrJob, OcrResult


class OcrRepository:
    async def create_document(
        self,
        *,
        user_id: int,
        document_type: DocumentType,
        file_name: str,
        file_path: str,
        file_size: int,
        mime_type: str,
    ) -> Document:
        return await Document.create(
            user_id=user_id,
            document_type=document_type,
            file_name=file_name,
            file_path=file_path,
            file_size=file_size,
            mime_type=mime_type,
        )

    async def get_user_document(self, *, document_id: int, user_id: int) -> Document | None:
        return await Document.get_or_none(id=document_id, user_id=user_id)

    async def create_job(self, *, user_id: int, document_id: int, max_retries: int) -> OcrJob:
        return await OcrJob.create(user_id=user_id, document_id=document_id, max_retries=max_retries)

    async def get_user_job(self, *, job_id: int, user_id: int) -> OcrJob | None:
        return await OcrJob.get_or_none(id=job_id, user_id=user_id)

    async def upsert_result(self, *, job_id: int, extracted_text: str, structured_data: dict[str, Any]) -> OcrResult:
        await OcrResult.update_or_create(
            job_id=job_id,
            defaults={
                "extracted_text": extracted_text,
                "structured_data": structured_data,
            },
        )
        result = await OcrResult.get_or_none(job_id=job_id)
        if result is None:
            raise RuntimeError("Failed to upsert OCR result.")
        return result
