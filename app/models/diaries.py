from __future__ import annotations

from typing import TYPE_CHECKING

from tortoise import fields, models
from tortoise.fields.relational import ForeignKeyRelation

if TYPE_CHECKING:
    from app.models.users import User


class DailyDiary(models.Model):
    id = fields.BigIntField(primary_key=True)
    user_id: int
    user: ForeignKeyRelation[User] = fields.ForeignKeyField(
        "models.User",
        related_name="diaries",
        on_delete=fields.CASCADE,
    )
    date = fields.DateField()
    content = fields.TextField(default="")
    created_at = fields.DatetimeField(auto_now_add=True)
    updated_at = fields.DatetimeField(auto_now=True)

    class Meta:
        table = "daily_diaries"
        unique_together = (("user_id", "date"),)
