from __future__ import annotations

from enum import StrEnum
from typing import TYPE_CHECKING, Any

from tortoise import fields, models
from tortoise.fields.relational import ForeignKeyRelation

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
    NOT_PRESCRIPTION = "NOT_PRESCRIPTION"


class Document(models.Model):
    id = fields.BigIntField(primary_key=True)
    user_id: int
    user: ForeignKeyRelation[User] = fields.ForeignKeyField(
        "models.User",
        related_name="documents",
        on_delete=fields.CASCADE,
    )
    document_type = fields.CharEnumField(enum_type=DocumentType)
    file_name = fields.CharField(max_length=255)
    temp_storage_key = fields.CharField(max_length=500)
    file_size = fields.BigIntField()
    mime_type = fields.CharField(max_length=100)
    uploaded_at = fields.DatetimeField(auto_now_add=True)
    disposed_at = fields.DatetimeField(null=True)

    class Meta:
        table = "documents"
        indexes = (("user_id", "uploaded_at"), ("document_type",))


class OcrJob(models.Model):
    id = fields.BigIntField(primary_key=True)
    user_id: int
    document_id: int
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

    raw_text = fields.TextField(null=True)
    text_blocks_json: list[dict[str, Any]] = fields.JSONField(null=True)
    structured_result: dict[str, Any] = fields.JSONField(null=True, default=dict)
    confirmed_result: dict[str, Any] = fields.JSONField(null=True, default=dict)
    needs_user_review = fields.BooleanField(default=False)

    queued_at = fields.DatetimeField(auto_now_add=True)
    started_at = fields.DatetimeField(null=True)
    completed_at = fields.DatetimeField(null=True)
    created_at = fields.DatetimeField(auto_now_add=True)
    updated_at = fields.DatetimeField(auto_now=True)

    class Meta:
        table = "ocr_jobs"
        indexes = (("user_id", "status"), ("document_id", "created_at"), ("status", "retry_count"))
