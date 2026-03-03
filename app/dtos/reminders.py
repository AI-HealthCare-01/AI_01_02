from datetime import date, datetime
from typing import Any

from pydantic import BaseModel, Field


class MedicationReminderUpsertRequest(BaseModel):
    medication_name: str
    dose: str | None = None
    schedule_times: list[str] = Field(min_length=1)
    start_date: date | None = None
    end_date: date | None = None
    dispensed_date: date | None = None
    total_days: int | None = None
    daily_intake_count: float | None = None
    enabled: bool = True


class ReminderResponse(BaseModel):
    id: str
    medication_name: str
    dose: str | None
    schedule_times: list[Any]
    start_date: date | None
    end_date: date | None
    enabled: bool
    created_at: datetime
    updated_at: datetime


class ReminderListResponse(BaseModel):
    items: list[ReminderResponse]


class DdayReminderItem(BaseModel):
    medication_name: str
    remaining_days: int
    estimated_depletion_date: date


class DdayReminderListResponse(BaseModel):
    items: list[DdayReminderItem]
