from datetime import datetime
from typing import Annotated, Any

from pydantic import BaseModel, Field

from app.dtos.base import BaseSerializerModel
from app.models.ocr import DocumentType, OcrFailureCode, OcrJobStatus


class DocumentUploadResponse(BaseSerializerModel):
    id: str
    document_type: DocumentType
    file_name: str
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
    structured_data: dict[str, Any]
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
    comment: str | None = Field(None, max_length=500)


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


class MedicationInfoResponse(BaseModel):
    item_name: str | None = None
    efficacy: str | None = None
    usage: str | None = None
    warnings: str | None = None
    precautions: str | None = None
    interactions: str | None = None
    side_effects: str | None = None
    storage: str | None = None
    source: str | None = None
