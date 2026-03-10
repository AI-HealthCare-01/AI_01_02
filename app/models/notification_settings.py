from __future__ import annotations

from typing import TYPE_CHECKING

from tortoise import fields, models
from tortoise.fields.relational import OneToOneRelation

if TYPE_CHECKING:
    from app.models.users import User


class UserNotificationSetting(models.Model):
    id = fields.BigIntField(primary_key=True)
    user_id: int
    user: OneToOneRelation[User] = fields.OneToOneField(
        "models.User",
        related_name="notification_setting",
        on_delete=fields.CASCADE,
    )
    home_schedule_enabled = fields.BooleanField(default=True)
    meal_alarm_enabled = fields.BooleanField(default=True)
    medication_alarm_enabled = fields.BooleanField(default=True)
    exercise_alarm_enabled = fields.BooleanField(default=True)
    sleep_alarm_enabled = fields.BooleanField(default=True)
    medication_dday_alarm_enabled = fields.BooleanField(default=True)
    created_at = fields.DatetimeField(auto_now_add=True)
    updated_at = fields.DatetimeField(auto_now=True)

    class Meta:
        table = "user_notification_settings"
        indexes = (("user_id",),)
