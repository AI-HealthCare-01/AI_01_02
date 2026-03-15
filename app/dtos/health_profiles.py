from datetime import datetime
from typing import Annotated

from pydantic import BaseModel, Field

from app.dtos.base import BaseSerializerModel


class BasicInfoInput(BaseModel):
    height_cm: Annotated[float, Field(gt=0, le=300)]
    weight_kg: Annotated[float, Field(gt=0, le=500)]
    drug_allergies: list[str] = Field(default_factory=list)


class LifestyleInput(BaseModel):
    exercise_frequency_per_week: Annotated[int, Field(ge=0, le=21)]
    pc_hours_per_day: Annotated[int, Field(ge=0, le=24)]
    smartphone_hours_per_day: Annotated[int, Field(ge=0, le=24)]
    caffeine_cups_per_day: Annotated[int, Field(ge=0, le=20)]
    smoking: Annotated[int, Field(ge=0, le=200)]
    alcohol_frequency_per_week: Annotated[int, Field(ge=0, le=21)]


class SleepInput(BaseModel):
    bed_time: Annotated[str, Field(pattern=r"^(?:[01]\d|2[0-3]):[0-5]\d$")]
    wake_time: Annotated[str, Field(pattern=r"^(?:[01]\d|2[0-3]):[0-5]\d$")]
    sleep_latency_minutes: Annotated[int, Field(ge=0, le=720)]
    night_awakenings_per_week: Annotated[int, Field(ge=0, le=70)]
    daytime_sleepiness: Annotated[int, Field(ge=0, le=10)]


class NutritionStatusInput(BaseModel):
    appetite_level: Annotated[int, Field(ge=0, le=10)]
    meal_regular: bool


class HealthProfileUpsertRequest(BaseModel):
    basic_info: BasicInfoInput
    lifestyle: LifestyleInput
    sleep_input: SleepInput
    nutrition_status: NutritionStatusInput
    weekly_refresh_weekday: Annotated[int | None, Field(default=None, ge=0, le=6)] = None
    weekly_refresh_time: Annotated[str | None, Field(default=None, pattern=r"^(?:[01]\d|2[0-3]):[0-5]\d$")] = None
    weekly_adherence_rate: Annotated[float | None, Field(default=None, ge=0, le=100)] = None


class ComputedHealthMetrics(BaseModel):
    bmi: float
    sleep_time_hours: float
    caffeine_mg: int
    digital_time_hours: int


class HealthProfileResponse(BaseSerializerModel):
    user_id: str
    basic_info: BasicInfoInput
    lifestyle: LifestyleInput
    sleep_input: SleepInput
    nutrition_status: NutritionStatusInput
    computed: ComputedHealthMetrics
    weekly_refresh_weekday: int | None
    weekly_refresh_time: str | None
    weekly_adherence_rate: float | None
    onboarding_completed_at: datetime | None
    updated_at: datetime
