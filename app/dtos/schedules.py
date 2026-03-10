from datetime import date, datetime

from pydantic import BaseModel

from app.models.reminders import ScheduleItemCategory, ScheduleItemStatus


class ScheduleItemResponse(BaseModel):
    item_id: str
    category: ScheduleItemCategory
    title: str
    scheduled_at: datetime
    status: ScheduleItemStatus
    completed_at: datetime | None


class DailyScheduleResponse(BaseModel):
    date: date
    items: list[ScheduleItemResponse]
    medication_done_count: int
    medication_total_count: int
    medication_adherence_rate_percent: float


class ScheduleItemStatusUpdateRequest(BaseModel):
    status: ScheduleItemStatus
    completed_at: datetime | None = None
