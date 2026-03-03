from __future__ import annotations

from enum import StrEnum
from typing import TYPE_CHECKING, Any

from tortoise import fields, models
from tortoise.fields.relational import ForeignKeyRelation

if TYPE_CHECKING:
    from app.models.users import User


class ChatSessionStatus(StrEnum):
    ACTIVE = "ACTIVE"
    CLOSED = "CLOSED"


class ChatRole(StrEnum):
    USER = "USER"
    ASSISTANT = "ASSISTANT"
    SYSTEM = "SYSTEM"


class ChatMessageStatus(StrEnum):
    PENDING = "PENDING"
    STREAMING = "STREAMING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"
    CANCELLED = "CANCELLED"


class ChatSession(models.Model):
    id = fields.BigIntField(primary_key=True)
    user_id: int
    user: ForeignKeyRelation[User] = fields.ForeignKeyField(
        "models.User", related_name="chat_sessions", on_delete=fields.CASCADE
    )
    title = fields.CharField(max_length=255, null=True)
    status = fields.CharEnumField(enum_type=ChatSessionStatus, default=ChatSessionStatus.ACTIVE)
    auto_close_after_minutes = fields.SmallIntField(default=20)
    last_activity_at = fields.DatetimeField(null=True)
    deleted_at = fields.DatetimeField(null=True)
    created_at = fields.DatetimeField(auto_now_add=True)
    updated_at = fields.DatetimeField(auto_now=True)

    class Meta:
        table = "chat_sessions"
        indexes = (("user_id", "status"), ("user_id", "deleted_at"))


class ChatMessage(models.Model):
    id = fields.BigIntField(primary_key=True)
    session_id: int
    session: ForeignKeyRelation[ChatSession] = fields.ForeignKeyField(
        "models.ChatSession", related_name="messages", on_delete=fields.CASCADE
    )
    role = fields.CharEnumField(enum_type=ChatRole)
    status = fields.CharEnumField(enum_type=ChatMessageStatus, default=ChatMessageStatus.PENDING)
    content = fields.TextField()
    needs_clarification = fields.BooleanField(default=False)
    intent_label = fields.CharField(max_length=20, null=True)
    references_json: list[dict[str, Any]] = fields.JSONField(default=list)  # type: ignore[assignment]
    retrieved_doc_ids: list = fields.JSONField(default=list)  # type: ignore[assignment]
    guardrail_blocked = fields.BooleanField(default=False)
    guardrail_reason = fields.CharField(max_length=200, null=True)
    last_token_seq = fields.IntField(default=0)
    prompt_version = fields.CharField(max_length=50, null=True)
    model_version = fields.CharField(max_length=50, null=True)
    created_at = fields.DatetimeField(auto_now_add=True)
    updated_at = fields.DatetimeField(auto_now=True)

    class Meta:
        table = "chat_messages"
        indexes = (
            ("session_id", "created_at"),
            ("session_id", "updated_at"),
            ("session_id", "status"),
            ("session_id", "guardrail_blocked"),
        )
