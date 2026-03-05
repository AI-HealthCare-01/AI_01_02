from datetime import datetime
from typing import Any

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


class OcrMedicationItem(BaseModel):
    drug_name: str
    dose: float | None = None
    frequency_per_day: int | None = None
    dosage_per_once: int | None = None
    intake_time: str | None = None  # morning/lunch/dinner/bedtime/PRN
    administration_timing: str | None = None  # 식전/식후
    dispensed_date: str | None = None
    total_days: int | None = None
    confidence: float | None = None


class OcrReviewConfirmRequest(BaseModel):
    confirmed: bool
    corrected_medications: list[OcrMedicationItem] = Field(default_factory=list)
    comment: str | None = None


class OcrConfirmResponse(BaseModel):
    job_id: str
    extracted_text: str
    structured_data: dict[str, Any]
    needs_user_review: bool
    created_at: datetime
    updated_at: datetime


class MedicationSearchItem(BaseModel):
    medication_id: str
    name: str
    score: float | None = None


class MedicationSearchResponse(BaseModel):
    items: list[MedicationSearchItem]
