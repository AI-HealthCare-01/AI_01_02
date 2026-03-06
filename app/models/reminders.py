from __future__ import annotations

from enum import StrEnum
from typing import TYPE_CHECKING

from tortoise import fields, models
from tortoise.fields.relational import ForeignKeyRelation

if TYPE_CHECKING:
    from app.models.users import User


class ScheduleItemCategory(StrEnum):
    MEDICATION = "MEDICATION"
    MEAL = "MEAL"
    EXERCISE = "EXERCISE"
    SLEEP = "SLEEP"


class ScheduleItemStatus(StrEnum):
    PENDING = "PENDING"
    DONE = "DONE"
    SKIPPED = "SKIPPED"


class MedicationReminder(models.Model):
    id = fields.BigIntField(primary_key=True)
    user_id: int
    user: ForeignKeyRelation[User] = fields.ForeignKeyField(
        "models.User", related_name="medication_reminders", on_delete=fields.CASCADE
    )
    medication_id: int | None
    medication: ForeignKeyRelation | None = fields.ForeignKeyField(
        "models.Medication", related_name="reminders", on_delete=fields.SET_NULL, null=True
    )
    medication_name = fields.CharField(max_length=255)
    dose_text = fields.CharField(max_length=100, null=True)
    schedule_times: list = fields.JSONField()  # type: ignore[assignment]
    start_date = fields.DateField(null=True)
    end_date = fields.DateField(null=True)
    dispensed_date = fields.DateField(null=True)
    total_days = fields.IntField(null=True)
    daily_intake_count = fields.DecimalField(max_digits=6, decimal_places=2, null=True)
    enabled = fields.BooleanField(default=True)
    created_at = fields.DatetimeField(auto_now_add=True)
    updated_at = fields.DatetimeField(auto_now=True)

    class Meta:
        table = "medication_reminders"
        indexes = (("user_id", "enabled"), ("user_id", "medication_name"), ("user_id", "medication_id"))


class ScheduleItem(models.Model):
    id = fields.BigIntField(primary_key=True)
    user_id: int
    user: ForeignKeyRelation[User] = fields.ForeignKeyField(
        "models.User", related_name="schedule_items", on_delete=fields.CASCADE
    )
    reminder_id: int | None
    reminder: ForeignKeyRelation | None = fields.ForeignKeyField(
        "models.MedicationReminder", related_name="schedule_items", on_delete=fields.SET_NULL, null=True
    )
    category = fields.CharEnumField(enum_type=ScheduleItemCategory)
    title = fields.CharField(max_length=255)
    scheduled_at = fields.DatetimeField()
    status = fields.CharEnumField(enum_type=ScheduleItemStatus, default=ScheduleItemStatus.PENDING)
    completed_at = fields.DatetimeField(null=True)
    created_at = fields.DatetimeField(auto_now_add=True)
    updated_at = fields.DatetimeField(auto_now=True)

    class Meta:
        table = "schedule_items"
        indexes = (("user_id", "scheduled_at"), ("user_id", "status"), ("reminder_id",))
