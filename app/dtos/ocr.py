from datetime import datetime
from typing import Annotated

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


class ExtractedMedication(BaseModel):
    drug_name: str
    dose: Annotated[float, Field(gt=0)]
    frequency_per_day: Annotated[int, Field(ge=1, le=12)]
    dosage_per_once: Annotated[int, Field(ge=1, le=20)]
    intake_time: list[str] = Field(default_factory=list)
    administration_timing: str
    dispensed_date: Annotated[str, Field(pattern=r"^\d{4}-\d{2}-\d{2}$")]
    total_days: Annotated[int, Field(ge=1, le=365)]
    side_effect: str | None = None


class OcrResultConfirmRequest(BaseModel):
    raw_text: str = Field(min_length=1)
    extracted_medications: list[ExtractedMedication] = Field(default_factory=list)


class OcrJobResultResponse(BaseModel):
    job_id: str
    extracted_text: str
    structured_data: dict
    created_at: datetime
    updated_at: datetime
