from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field

from app.models.chat import ChatMessageStatus, ChatRole, ChatSessionStatus


class ChatSessionCreateRequest(BaseModel):
    title: str | None = Field(None, max_length=100)


class ChatSessionResponse(BaseModel):
    id: str
    status: ChatSessionStatus
    title: str | None
    last_activity_at: datetime | None
    auto_close_after_minutes: int
    created_at: datetime


class ChatPromptOption(BaseModel):
    id: str
    label: str
    category: str | None = None


class ChatPromptOptionsResponse(BaseModel):
    items: list[ChatPromptOption]


class ChatMessageSendRequest(BaseModel):
    message: str = Field(min_length=1, max_length=5000)
    stream: bool = True


class ChatReferenceItem(BaseModel):
    document_id: str
    title: str
    source: str
    url: str | None = None
    score: float | None = None


class ChatMessageResponse(BaseModel):
    id: str
    role: ChatRole
    status: ChatMessageStatus
    content: str
    last_token_seq: int
    references: list[ChatReferenceItem]
    needs_clarification: bool
    updated_at: datetime
    created_at: datetime


class ChatMessageListResponse(BaseModel):
    items: list[ChatMessageResponse]
    meta: dict[str, Any]
