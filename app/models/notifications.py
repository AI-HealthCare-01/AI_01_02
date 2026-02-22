from __future__ import annotations

from enum import StrEnum
from typing import TYPE_CHECKING, Any

from tortoise import fields, models
from tortoise.fields.relational import ForeignKeyRelation

if TYPE_CHECKING:
    from app.models.users import User


class NotificationType(StrEnum):
    SYSTEM = "SYSTEM"
    HEALTH_ALERT = "HEALTH_ALERT"
    REPORT_READY = "REPORT_READY"
    GUIDE_READY = "GUIDE_READY"


class Notification(models.Model):
    id = fields.BigIntField(primary_key=True)
    user: ForeignKeyRelation[User] = fields.ForeignKeyField(
        "models.User",
        related_name="notifications",
        on_delete=fields.CASCADE,
    )
    type = fields.CharEnumField(enum_type=NotificationType, default=NotificationType.SYSTEM)
    title = fields.CharField(max_length=100)
    message = fields.TextField()
    is_read = fields.BooleanField(default=False)
    read_at = fields.DatetimeField(null=True)
    payload: dict[str, Any] = fields.JSONField(default=dict)
    created_at = fields.DatetimeField(auto_now_add=True)

    class Meta:
        table = "notifications"
        indexes = (("user_id", "is_read"), ("user_id", "created_at"))
