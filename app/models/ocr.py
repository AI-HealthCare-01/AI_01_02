from __future__ import annotations

from enum import StrEnum
from typing import TYPE_CHECKING, Any

from tortoise import fields, models
from tortoise.fields.relational import ForeignKeyRelation, OneToOneRelation

if TYPE_CHECKING:
    from app.models.users import User


class DocumentType(StrEnum):
    MEDICAL_RECORD = "MEDICAL_RECORD"
    PRESCRIPTION = "PRESCRIPTION"
    MEDICATION_BAG = "MEDICATION_BAG"


class OcrJobStatus(StrEnum):
    QUEUED = "QUEUED"
    PROCESSING = "PROCESSING"
    SUCCEEDED = "SUCCEEDED"
    FAILED = "FAILED"


class OcrFailureCode(StrEnum):
    FILE_NOT_FOUND = "FILE_NOT_FOUND"
    INVALID_STATE_TRANSITION = "INVALID_STATE_TRANSITION"
    PROCESSING_ERROR = "PROCESSING_ERROR"


class Document(models.Model):
    id = fields.BigIntField(primary_key=True)
    user: ForeignKeyRelation[User] = fields.ForeignKeyField(
        "models.User",
        related_name="documents",
        on_delete=fields.CASCADE,
    )
    document_type = fields.CharEnumField(enum_type=DocumentType)
    file_name = fields.CharField(max_length=255)
    file_path = fields.CharField(max_length=500)
    file_size = fields.BigIntField()
    mime_type = fields.CharField(max_length=100)
    uploaded_at = fields.DatetimeField(auto_now_add=True)

    class Meta:
        table = "documents"
        indexes = (("user_id", "uploaded_at"), ("document_type",))


class OcrJob(models.Model):
    id = fields.BigIntField(primary_key=True)
    user: ForeignKeyRelation[User] = fields.ForeignKeyField(
        "models.User",
        related_name="ocr_jobs",
        on_delete=fields.CASCADE,
    )
    document: ForeignKeyRelation[Document] = fields.ForeignKeyField(
        "models.Document",
        related_name="ocr_jobs",
        on_delete=fields.CASCADE,
    )
    status = fields.CharEnumField(enum_type=OcrJobStatus, default=OcrJobStatus.QUEUED)
    retry_count = fields.IntField(default=0)
    max_retries = fields.IntField(default=3)
    failure_code = fields.CharEnumField(enum_type=OcrFailureCode, null=True)
    error_message = fields.TextField(null=True)
    queued_at = fields.DatetimeField(auto_now_add=True)
    started_at = fields.DatetimeField(null=True)
    completed_at = fields.DatetimeField(null=True)
    created_at = fields.DatetimeField(auto_now_add=True)
    updated_at = fields.DatetimeField(auto_now=True)

    class Meta:
        table = "ocr_jobs"
        indexes = (("user_id", "status"), ("document_id", "created_at"), ("status", "retry_count"))


class OcrResult(models.Model):
    id = fields.BigIntField(primary_key=True)
    job: OneToOneRelation[OcrJob] = fields.OneToOneField(
        "models.OcrJob",
        related_name="result",
        on_delete=fields.CASCADE,
    )
    extracted_text = fields.TextField()
    structured_data: dict[str, Any] = fields.JSONField(default=dict)
    created_at = fields.DatetimeField(auto_now_add=True)
    updated_at = fields.DatetimeField(auto_now=True)

    class Meta:
        table = "ocr_results"
