from datetime import datetime

from pydantic import BaseModel

from app.models.guides import GuideFailureCode, GuideJobStatus, GuideRiskLevel


class GuideJobCreateRequest(BaseModel):
    ocr_job_id: int


class GuideJobCreateResponse(BaseModel):
    job_id: int
    status: GuideJobStatus
    retry_count: int
    max_retries: int
    queued_at: datetime


class GuideJobStatusResponse(BaseModel):
    job_id: int
    ocr_job_id: int
    status: GuideJobStatus
    retry_count: int
    max_retries: int
    failure_code: GuideFailureCode | None
    error_message: str | None
    queued_at: datetime
    started_at: datetime | None
    completed_at: datetime | None


class GuideJobResultResponse(BaseModel):
    job_id: int
    medication_guidance: str
    lifestyle_guidance: str
    risk_level: GuideRiskLevel
    safety_notice: str
    structured_data: dict
    created_at: datetime
    updated_at: datetime
