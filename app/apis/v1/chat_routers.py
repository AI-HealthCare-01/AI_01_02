import json
from typing import Annotated

from fastapi import APIRouter, Depends, Path, Query, status
from fastapi.responses import ORJSONResponse as Response
from fastapi.responses import StreamingResponse

from app.dependencies.security import get_request_user
from app.dtos.chat import (
    ChatMessageListResponse,
    ChatMessageResponse,
    ChatMessageSendRequest,
    ChatPromptOption,
    ChatPromptOptionsResponse,
    ChatSessionCreateRequest,
    ChatSessionResponse,
)
from app.models.users import User
from app.services.chat import ChatService

chat_router = APIRouter(prefix="/chat", tags=["chat"])


def _serialize_session(session) -> ChatSessionResponse:  # type: ignore[no-untyped-def]
    return ChatSessionResponse(
        id=str(session.id),
        status=session.status,
        title=session.title,
        last_activity_at=session.last_activity_at,
        auto_close_after_minutes=session.auto_close_after_minutes,
        created_at=session.created_at,
    )


def _serialize_message(msg) -> ChatMessageResponse:  # type: ignore[no-untyped-def]
    return ChatMessageResponse(
        id=str(msg.id),
        role=msg.role,
        status=msg.status,
        content=msg.content,
        last_token_seq=msg.last_token_seq,
        references=msg.references_json or [],
        needs_clarification=msg.needs_clarification,
        updated_at=msg.updated_at,
        created_at=msg.created_at,
    )


@chat_router.get("/prompt-options", response_model=ChatPromptOptionsResponse, status_code=status.HTTP_200_OK)
async def get_prompt_options(
    user: Annotated[User, Depends(get_request_user)],
    service: Annotated[ChatService, Depends(ChatService)],
) -> Response:
    options = await service.get_prompt_options()
    return Response(
        ChatPromptOptionsResponse(items=[ChatPromptOption(**o) for o in options]).model_dump(),
        status_code=status.HTTP_200_OK,
    )


@chat_router.post("/sessions", response_model=ChatSessionResponse, status_code=status.HTTP_201_CREATED)
async def create_session(
    request: ChatSessionCreateRequest,
    user: Annotated[User, Depends(get_request_user)],
    service: Annotated[ChatService, Depends(ChatService)],
) -> Response:
    session = await service.create_session(user=user, title=request.title)
    return Response(_serialize_session(session).model_dump(), status_code=status.HTTP_201_CREATED)


@chat_router.get(
    "/sessions/{session_id}/messages",
    response_model=ChatMessageListResponse,
    status_code=status.HTTP_200_OK,
)
async def list_messages(
    session_id: Annotated[str, Path(pattern=r"^\d+$")],
    user: Annotated[User, Depends(get_request_user)],
    service: Annotated[ChatService, Depends(ChatService)],
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> Response:
    messages, total = await service.list_messages(user=user, session_id=int(session_id), limit=limit, offset=offset)
    return Response(
        ChatMessageListResponse(
            items=[_serialize_message(m) for m in messages],
            meta={"limit": limit, "offset": offset, "total": total},
        ).model_dump(),
        status_code=status.HTTP_200_OK,
    )


@chat_router.post(
    "/sessions/{session_id}/messages",
    response_model=ChatMessageResponse,
    status_code=status.HTTP_201_CREATED,
)
async def send_message(
    session_id: Annotated[str, Path(pattern=r"^\d+$")],
    request: ChatMessageSendRequest,
    user: Annotated[User, Depends(get_request_user)],
    service: Annotated[ChatService, Depends(ChatService)],
) -> Response:
    msg = await service.send_message(user=user, session_id=int(session_id), message=request.message)
    return Response(_serialize_message(msg).model_dump(), status_code=status.HTTP_201_CREATED)


@chat_router.post(
    "/sessions/{session_id}/stream",
    status_code=status.HTTP_200_OK,
)
async def stream_message(
    session_id: Annotated[str, Path(pattern=r"^\d+$")],
    request: ChatMessageSendRequest,
    user: Annotated[User, Depends(get_request_user)],
    service: Annotated[ChatService, Depends(ChatService)],
) -> StreamingResponse:
    event_gen = await service.stream_message(user=user, session_id=int(session_id), message=request.message)

    async def _sse_generator():
        async for event_name, data in event_gen:
            yield f"event: {event_name}\ndata: {json.dumps(data, ensure_ascii=False)}\n\n"
        yield "event: done\ndata: {}\n\n"

    return StreamingResponse(_sse_generator(), media_type="text/event-stream")


@chat_router.delete("/sessions/{session_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_session(
    session_id: Annotated[str, Path(pattern=r"^\d+$")],
    user: Annotated[User, Depends(get_request_user)],
    service: Annotated[ChatService, Depends(ChatService)],
) -> None:
    await service.delete_session(user=user, session_id=int(session_id))
