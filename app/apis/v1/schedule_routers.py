from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends, Path, Query, status
from fastapi.responses import ORJSONResponse as Response

from app.dependencies.security import get_request_user
from app.dtos.schedules import DailyScheduleResponse, ScheduleItemResponse, ScheduleItemStatusUpdateRequest
from app.models.users import User
from app.services.schedules import ScheduleService

schedule_router = APIRouter(prefix="/schedules", tags=["schedules"])


def _serialize_item(item) -> ScheduleItemResponse:  # type: ignore[no-untyped-def]
    return ScheduleItemResponse(
        item_id=str(item.id),
        category=item.category,
        title=item.title,
        scheduled_at=item.scheduled_at,
        status=item.status,
        completed_at=item.completed_at,
    )


@schedule_router.get("/daily", response_model=DailyScheduleResponse, status_code=status.HTTP_200_OK)
async def get_daily_schedule(
    user: Annotated[User, Depends(get_request_user)],
    service: Annotated[ScheduleService, Depends(ScheduleService)],
    target_date: Annotated[date, Query(alias="date")],
    timezone: Annotated[str | None, Query(max_length=50)] = None,
) -> Response:
    items = await service.get_daily_schedule(user=user, target_date=target_date, timezone=timezone)
    done_count, total_count, adherence_rate = service.calculate_medication_adherence(items)
    return Response(
        DailyScheduleResponse(
            date=target_date,
            items=[_serialize_item(i) for i in items],
            medication_done_count=done_count,
            medication_total_count=total_count,
            medication_adherence_rate_percent=adherence_rate,
        ).model_dump(),
        status_code=status.HTTP_200_OK,
    )


@schedule_router.patch("/items/{item_id}/status", response_model=ScheduleItemResponse, status_code=status.HTTP_200_OK)
async def update_schedule_item_status(
    item_id: Annotated[str, Path(pattern=r"^\d+$")],
    data: ScheduleItemStatusUpdateRequest,
    user: Annotated[User, Depends(get_request_user)],
    service: Annotated[ScheduleService, Depends(ScheduleService)],
) -> Response:
    item = await service.update_item_status(user=user, item_id=int(item_id), data=data)
    return Response(_serialize_item(item).model_dump(), status_code=status.HTTP_200_OK)
