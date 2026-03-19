from __future__ import annotations

from typing import TYPE_CHECKING

from tortoise import fields, models
from tortoise.fields.relational import ForeignKeyRelation, ReverseRelation

if TYPE_CHECKING:
    from app.models.users import User


class PrescriptionHistory(models.Model):
    id = fields.BigIntField(primary_key=True)
    user_id: int
    user: ForeignKeyRelation[User] = fields.ForeignKeyField(
        "models.User", related_name="prescription_histories", on_delete=fields.CASCADE
    )
    source_ocr_job_id = fields.BigIntField(unique=True)
    prescribed_date = fields.DateField()
    days_supply = fields.IntField()
    start_date = fields.DateField()
    end_date = fields.DateField()
    created_at = fields.DatetimeField(auto_now_add=True)
    updated_at = fields.DatetimeField(auto_now=True)

    medications: ReverseRelation["PrescriptionMedication"]

    class Meta:
        table = "prescription_histories"
        indexes = (("user_id", "start_date", "end_date"), ("user_id", "prescribed_date"))


class PrescriptionMedication(models.Model):
    id = fields.BigIntField(primary_key=True)
    prescription_id: int
    prescription: ForeignKeyRelation[PrescriptionHistory] = fields.ForeignKeyField(
        "models.PrescriptionHistory", related_name="medications", on_delete=fields.CASCADE
    )
    medication_name = fields.CharField(max_length=255)
    dose = fields.FloatField(null=True)
    frequency_per_day = fields.IntField(null=True)
    dosage_per_once = fields.IntField(null=True)
    schedule_times: list = fields.JSONField()  # type: ignore[assignment]
    administration_timing = fields.CharField(max_length=100, null=True)
    dispensed_date = fields.DateField(null=True)
    total_days = fields.IntField(null=True)
    start_date = fields.DateField(null=True)
    end_date = fields.DateField(null=True)
    raw_payload: dict = fields.JSONField(default=dict)  # type: ignore[assignment]
    created_at = fields.DatetimeField(auto_now_add=True)
    updated_at = fields.DatetimeField(auto_now=True)

    class Meta:
        table = "prescription_medications"
        indexes = (("prescription_id", "medication_name"), ("start_date", "end_date"))
