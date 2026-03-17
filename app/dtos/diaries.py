from datetime import date, datetime

from pydantic import BaseModel, Field


class DiaryUpsertRequest(BaseModel):
    content: str = Field(max_length=5000)


class DiaryResponse(BaseModel):
    date: date
    content: str
    updated_at: datetime | None = None


class DiaryListResponse(BaseModel):
    items: list[DiaryResponse]
