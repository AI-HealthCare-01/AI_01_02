from datetime import datetime
from typing import Annotated, Any

from pydantic import BaseModel, Field

from app.dtos.base import BaseSerializerModel


class BasicInfo(BaseModel):
    height_cm: Annotated[float, Field(gt=0, le=300)]
    weight_kg: Annotated[float, Field(gt=0, le=500)]
    drug_allergies: list[str] = Field(default_factory=list)


class ExerciseHours(BaseModel):
    low_intensity: int = 0
    moderate_intensity: int = 0
    high_intensity: int = 0


class DigitalUsage(BaseModel):
    pc_hours_per_day: int = 0
    smartphone_hours_per_day: int = 0


class SubstanceUsage(BaseModel):
    caffeine_cups_per_day: int = 0
    smoking: int = 0
    alcohol_frequency_per_week: int = 0


class LifestyleInput(BaseModel):
    exercise_hours: ExerciseHours = Field(default_factory=ExerciseHours)
    digital_usage: DigitalUsage = Field(default_factory=DigitalUsage)
    substance_usage: SubstanceUsage = Field(default_factory=SubstanceUsage)


class SleepInput(BaseModel):
    bed_time: str | None = None
    wake_time: str | None = None
    sleep_latency_minutes: int | None = None
    night_awakenings_per_week: int | None = None
    daytime_sleepiness_score: int | None = None


class NutritionInput(BaseModel):
    appetite_score: int | None = Field(None, ge=0, le=10)
    is_meal_regular: bool | None = None


class HealthProfileUpsertRequest(BaseModel):
    basic_info: BasicInfo
    lifestyle_input: LifestyleInput = Field(default_factory=lambda: LifestyleInput())
    sleep_input: SleepInput = Field(default_factory=lambda: SleepInput())
    nutrition_input: NutritionInput = Field(
        default_factory=lambda: NutritionInput(appetite_score=None, is_meal_regular=None)
    )


class HealthProfileResponse(BaseSerializerModel):
    id: str
    user_id: str
    basic_info: dict[str, Any]
    lifestyle_input: dict[str, Any]
    sleep_input: dict[str, Any]
    nutrition_input: dict[str, Any]
    created_at: datetime
    updated_at: datetime
