from __future__ import annotations

from tortoise import fields, models
from tortoise.fields.relational import OneToOneRelation

from app.models.users import User


class UserHealthProfile(models.Model):
    id = fields.BigIntField(primary_key=True)
    user_id: int
    user: OneToOneRelation[User] = fields.OneToOneField(
        "models.User",
        related_name="health_profile",
        on_delete=fields.CASCADE,
    )

    height_cm = fields.FloatField()
    weight_kg = fields.FloatField()
    drug_allergies: list[str] = fields.JSONField(default=list)

    exercise_frequency_per_week = fields.IntField()
    pc_hours_per_day = fields.IntField()
    smartphone_hours_per_day = fields.IntField()
    caffeine_cups_per_day = fields.IntField()
    smoking = fields.IntField()
    alcohol_frequency_per_week = fields.IntField()

    bed_time = fields.CharField(max_length=5)
    wake_time = fields.CharField(max_length=5)
    sleep_latency_minutes = fields.IntField()
    night_awakenings_per_week = fields.IntField()
    daytime_sleepiness = fields.IntField()

    appetite_level = fields.IntField()
    meal_regular = fields.BooleanField()

    bmi = fields.FloatField()
    sleep_time_hours = fields.FloatField()
    caffeine_mg = fields.IntField()
    digital_time_hours = fields.IntField()

    weekly_refresh_weekday = fields.IntField(null=True)
    weekly_refresh_time = fields.CharField(max_length=5, null=True)
    weekly_adherence_rate = fields.FloatField(null=True)

    onboarding_completed_at = fields.DatetimeField(null=True)
    created_at = fields.DatetimeField(auto_now_add=True)
    updated_at = fields.DatetimeField(auto_now=True)

    class Meta:
        table = "user_health_profiles"
        indexes = (("user_id", "updated_at"),)
