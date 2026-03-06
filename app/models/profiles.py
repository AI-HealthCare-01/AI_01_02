from __future__ import annotations

from typing import TYPE_CHECKING, Any

from tortoise import fields, models
from tortoise.fields.relational import OneToOneRelation

if TYPE_CHECKING:
    from app.models.users import User


class HealthProfile(models.Model):
    id = fields.BigIntField(primary_key=True)
    user_id: int
    user: OneToOneRelation[User] = fields.OneToOneField(
        "models.User",
        related_name="health_profile",
        on_delete=fields.CASCADE,
    )
    basic_info: dict[str, Any] = fields.JSONField(default=dict)
    lifestyle_input: dict[str, Any] = fields.JSONField(default=dict)
    sleep_input: dict[str, Any] = fields.JSONField(default=dict)
    nutrition_input: dict[str, Any] = fields.JSONField(default=dict)
    created_at = fields.DatetimeField(auto_now_add=True)
    updated_at = fields.DatetimeField(auto_now=True)

    class Meta:
        table = "health_profiles"
