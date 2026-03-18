from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends, Path, Query, status
from fastapi.responses import ORJSONResponse as Response

from app.core.exceptions import AppException, ErrorCode
from app.dependencies.security import get_request_user
from app.dtos.diaries import DiaryListResponse, DiaryResponse, DiaryUpsertRequest
from app.models.users import User
from app.services.diaries import DiaryService

diary_router = APIRouter(prefix="/diaries", tags=["diaries"])


def _serialize(d) -> DiaryResponse:  # type: ignore[no-untyped-def]
    return DiaryResponse(date=d.date, content=d.content, updated_at=d.updated_at)


@diary_router.put("/{diary_date}", response_model=DiaryResponse, status_code=status.HTTP_200_OK)
async def upsert_diary(
    diary_date: Annotated[date, Path()],
    data: DiaryUpsertRequest,
    user: Annotated[User, Depends(get_request_user)],
    service: Annotated[DiaryService, Depends(DiaryService)],
) -> Response:
    diary = await service.upsert(user=user, diary_date=diary_date, content=data.content)
    return Response(_serialize(diary).model_dump(), status_code=status.HTTP_200_OK)


@diary_router.get("/{diary_date}", response_model=DiaryResponse, status_code=status.HTTP_200_OK)
async def get_diary(
    diary_date: Annotated[date, Path()],
    user: Annotated[User, Depends(get_request_user)],
    service: Annotated[DiaryService, Depends(DiaryService)],
) -> Response:
    diary = await service.get_by_date(user=user, diary_date=diary_date)
    if diary is None:
        return Response(
            DiaryResponse(date=diary_date, content="").model_dump(),
            status_code=status.HTTP_200_OK,
        )
    return Response(_serialize(diary).model_dump(), status_code=status.HTTP_200_OK)


@diary_router.get("", response_model=DiaryListResponse, status_code=status.HTTP_200_OK)
async def list_diaries(
    user: Annotated[User, Depends(get_request_user)],
    service: Annotated[DiaryService, Depends(DiaryService)],
    start: Annotated[date, Query()],
    end: Annotated[date, Query()],
) -> Response:
    if start > end:
        raise AppException(ErrorCode.VALIDATION_ERROR, developer_message="start must be <= end")
    diaries = await service.list_range(user=user, start=start, end=end)
    return Response(
        DiaryListResponse(items=[_serialize(d) for d in diaries]).model_dump(),
        status_code=status.HTTP_200_OK,
    )
