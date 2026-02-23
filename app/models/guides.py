from __future__ import annotations

from enum import StrEnum
from typing import TYPE_CHECKING, Any

from tortoise import fields, models
from tortoise.fields.relational import ForeignKeyRelation, OneToOneRelation

if TYPE_CHECKING:
    from app.models.ocr import OcrJob
    from app.models.users import User


class GuideJobStatus(StrEnum):
    QUEUED = "QUEUED"
    PROCESSING = "PROCESSING"
    SUCCEEDED = "SUCCEEDED"
    FAILED = "FAILED"


class GuideFailureCode(StrEnum):
    OCR_NOT_READY = "OCR_NOT_READY"
    OCR_RESULT_NOT_FOUND = "OCR_RESULT_NOT_FOUND"
    INVALID_STATE_TRANSITION = "INVALID_STATE_TRANSITION"
    PROCESSING_ERROR = "PROCESSING_ERROR"


class GuideRiskLevel(StrEnum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"


class GuideJob(models.Model):
    id = fields.BigIntField(primary_key=True)
    user_id: int
    ocr_job_id: int
    user: ForeignKeyRelation[User] = fields.ForeignKeyField(
        "models.User",
        related_name="guide_jobs",
        on_delete=fields.CASCADE,
    )
    ocr_job: ForeignKeyRelation[OcrJob] = fields.ForeignKeyField(
        "models.OcrJob",
        related_name="guide_jobs",
        on_delete=fields.CASCADE,
    )
    status = fields.CharEnumField(enum_type=GuideJobStatus, default=GuideJobStatus.QUEUED)
    retry_count = fields.IntField(default=0)
    max_retries = fields.IntField(default=3)
    failure_code = fields.CharEnumField(enum_type=GuideFailureCode, null=True)
    error_message = fields.TextField(null=True)
    queued_at = fields.DatetimeField(auto_now_add=True)
    started_at = fields.DatetimeField(null=True)
    completed_at = fields.DatetimeField(null=True)
    created_at = fields.DatetimeField(auto_now_add=True)
    updated_at = fields.DatetimeField(auto_now=True)

    class Meta:
        table = "guide_jobs"
        indexes = (("user_id", "status"), ("ocr_job_id", "created_at"), ("status", "retry_count"))


class GuideResult(models.Model):
    id = fields.BigIntField(primary_key=True)
    job_id: int
    job: OneToOneRelation[GuideJob] = fields.OneToOneField(
        "models.GuideJob",
        related_name="result",
        on_delete=fields.CASCADE,
    )
    medication_guidance = fields.TextField()
    lifestyle_guidance = fields.TextField()
    risk_level = fields.CharEnumField(enum_type=GuideRiskLevel, default=GuideRiskLevel.MEDIUM)
    safety_notice = fields.TextField()
    structured_data: dict[str, Any] = fields.JSONField(default=dict)
    created_at = fields.DatetimeField(auto_now_add=True)
    updated_at = fields.DatetimeField(auto_now=True)

    class Meta:
        table = "guide_results"
