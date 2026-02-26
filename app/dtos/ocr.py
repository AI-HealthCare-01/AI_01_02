from datetime import datetime

from pydantic import BaseModel, Field

from app.dtos.base import BaseSerializerModel
from app.models.ocr import DocumentType, OcrFailureCode, OcrJobStatus


class DocumentUploadResponse(BaseSerializerModel):
    id: str
    document_type: DocumentType
    file_name: str
    file_path: str
    file_size: int
    mime_type: str
    uploaded_at: datetime


class OcrJobCreateRequest(BaseModel):
    document_id: str = Field(pattern=r"^\d+$")


class OcrJobCreateResponse(BaseModel):
    job_id: str
    status: OcrJobStatus
    retry_count: int
    max_retries: int
    queued_at: datetime


class OcrJobStatusResponse(BaseModel):
    job_id: str
    document_id: str
    status: OcrJobStatus
    retry_count: int
    max_retries: int
    failure_code: OcrFailureCode | None
    error_message: str | None
    queued_at: datetime
    started_at: datetime | None
    completed_at: datetime | None


class OcrJobResultResponse(BaseModel):
    job_id: str
    extracted_text: str
    structured_data: dict
    created_at: datetime
    updated_at: datetime
