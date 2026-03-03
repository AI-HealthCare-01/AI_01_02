from datetime import datetime

from pydantic import BaseModel, Field

from app.models.guides import GuideFailureCode, GuideJobStatus, GuideRiskLevel


class GuideSourceReference(BaseModel):
    title: str
    source: str
    url: str | None = None
    used_at: datetime | None = None


class GuideRefreshRequest(BaseModel):
    reason: str | None = None


class GuideRefreshResponse(BaseModel):
    refreshed_job_id: str
    status: GuideJobStatus


class GuideJobCreateRequest(BaseModel):
    ocr_job_id: str = Field(pattern=r"^\d+$")


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
    source_references: list[GuideSourceReference] = []
    adherence_rate_percent: float | None = None
    structured_data: dict
    created_at: datetime
    updated_at: datetime
