from datetime import date, datetime

from pydantic import BaseModel, Field


class MedicationReminderUpsertRequest(BaseModel):
    medication_name: str = Field(min_length=1, max_length=100)
    dose: str | None = Field(None, max_length=50)
    schedule_times: list[str] = Field(min_length=1)
    start_date: date | None = None
    end_date: date | None = None
    dispensed_date: date | None = None
    total_days: int | None = Field(None, ge=1, le=365)
    daily_intake_count: float | None = Field(None, ge=0)
    enabled: bool = True


class ReminderResponse(BaseModel):
    id: str
    medication_name: str
    dose: str | None
    schedule_times: list[str]
    start_date: date | None
    end_date: date | None
    dispensed_date: date | None
    total_days: int | None
    daily_intake_count: float | None
    confirmed_intake_count: int
    responded_intake_count: int
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
