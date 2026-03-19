from datetime import date, datetime

from pydantic import BaseModel

from app.models.reminders import ScheduleItemCategory, ScheduleItemStatus


class ScheduleItemResponse(BaseModel):
    item_id: str
    category: ScheduleItemCategory
    title: str
    medication_name: str | None = None
    scheduled_at: datetime
    status: ScheduleItemStatus
    completed_at: datetime | None


class ScheduleMedicationResponse(BaseModel):
    drug_name: str
    dose: float | None
    frequency_per_day: int | None
    dosage_per_once: int | None
    intake_time: str | None
    dispensed_date: date | None
    total_days: int | None
    confidence: float | None = None


class DailyScheduleResponse(BaseModel):
    date: date
    items: list[ScheduleItemResponse]
    medications: list[ScheduleMedicationResponse]
    medication_done_count: int
    medication_total_count: int
    medication_adherence_rate_percent: float


class ScheduleItemStatusUpdateRequest(BaseModel):
    status: ScheduleItemStatus
    completed_at: datetime | None = None
