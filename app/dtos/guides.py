from datetime import datetime

from pydantic import BaseModel, Field

from app.dtos.health_profiles import HealthProfileUpsertRequest
from app.dtos.ocr import OcrResultConfirmRequest
from app.models.guides import GuideFailureCode, GuideJobStatus, GuideRiskLevel


class GuideJobCreateRequest(BaseModel):
    ocr_job_id: str = Field(pattern=r"^\d+$")


class GuideJobCreateFromSnapshotRequest(BaseModel):
    ocr_job_id: str = Field(pattern=r"^\d+$")
    health_profile: HealthProfileUpsertRequest
    ocr_result: OcrResultConfirmRequest


class GuideJobCreateResponse(BaseModel):
    job_id: str
    status: GuideJobStatus
    retry_count: int
    max_retries: int
    queued_at: datetime


class GuideJobStatusResponse(BaseModel):
    job_id: str
    ocr_job_id: str
    status: GuideJobStatus
    retry_count: int
    max_retries: int
    failure_code: GuideFailureCode | None
    error_message: str | None
    queued_at: datetime
    started_at: datetime | None
    completed_at: datetime | None


class GuideJobResultResponse(BaseModel):
    job_id: str
    medication_guidance: str
    lifestyle_guidance: str
    risk_level: GuideRiskLevel
    safety_notice: str
    personalized_guides: dict | None = None
    source_attributions: list[str] | None = None
    weekly_adherence_rate: float | None = None
    structured_data: dict
    created_at: datetime
    updated_at: datetime
