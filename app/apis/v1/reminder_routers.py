from typing import Annotated

from fastapi import APIRouter, Depends, Path, Query, status
from fastapi.responses import ORJSONResponse as Response
from starlette.responses import Response as StarletteResponse
from tortoise import functions

from app.core.logger import default_logger as logger
from app.dependencies.security import get_request_user
from app.dtos.reminders import (
    DdayReminderListResponse,
    MedicationReminderUpsertRequest,
    ReminderListResponse,
    ReminderResponse,
)
from app.models.reminders import ScheduleItem, ScheduleItemStatus
from app.models.users import User
from app.services.reminders import ReminderService

reminder_router = APIRouter(prefix="/reminders", tags=["reminders"])


def _serialize(r) -> ReminderResponse:  # type: ignore[no-untyped-def]
    confirmed_intake_count = int(getattr(r, "confirmed_intake_count", 0) or 0)
    responded_intake_count = int(getattr(r, "responded_intake_count", 0) or 0)
    return ReminderResponse(
        id=str(r.id),
        medication_name=r.medication_name,
        dose=r.dose_text,
        schedule_times=r.schedule_times,
        start_date=r.start_date,
        end_date=r.end_date,
        dispensed_date=r.dispensed_date,
        total_days=r.total_days,
        daily_intake_count=float(r.daily_intake_count) if r.daily_intake_count is not None else None,
        confirmed_intake_count=confirmed_intake_count,
        responded_intake_count=responded_intake_count,
        enabled=r.enabled,
        created_at=r.created_at,
        updated_at=r.updated_at,
    )


@reminder_router.post("", response_model=ReminderResponse, status_code=status.HTTP_201_CREATED)
async def create_reminder(
    data: MedicationReminderUpsertRequest,
    user: Annotated[User, Depends(get_request_user)],
    service: Annotated[ReminderService, Depends(ReminderService)],
) -> Response:
    reminder = await service.create_reminder(user=user, data=data)
    return Response(_serialize(reminder).model_dump(), status_code=status.HTTP_201_CREATED)


@reminder_router.get("", response_model=ReminderListResponse, status_code=status.HTTP_200_OK)
async def list_reminders(
    user: Annotated[User, Depends(get_request_user)],
    service: Annotated[ReminderService, Depends(ReminderService)],
    enabled: Annotated[bool | None, Query()] = None,
    limit: Annotated[int, Query(ge=1, le=100)] = 50,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> Response:
    reminders = await service.list_reminders(user=user, enabled=enabled, limit=limit, offset=offset)
    reminder_ids = [r.id for r in reminders]
    confirmed_count_by_reminder_id: dict[int, int] = {}
    responded_count_by_reminder_id: dict[int, int] = {}
    try:
        if reminder_ids:
            confirmed_rows = (
                await ScheduleItem.filter(
                    reminder_id__in=reminder_ids,
                    status=ScheduleItemStatus.DONE,
                )
                .group_by("reminder_id")
                .annotate(confirmed_count=functions.Count("id"))
                .values("reminder_id", "confirmed_count")
            )
            confirmed_count_by_reminder_id = {
                int(row["reminder_id"]): int(row["confirmed_count"])
                for row in confirmed_rows
                if row.get("reminder_id") is not None
            }
            responded_rows = (
                await ScheduleItem.filter(
                    reminder_id__in=reminder_ids,
                    status__in=[ScheduleItemStatus.DONE, ScheduleItemStatus.SKIPPED],
                )
                .group_by("reminder_id")
                .annotate(responded_count=functions.Count("id"))
                .values("reminder_id", "responded_count")
            )
            responded_count_by_reminder_id = {
                int(row["reminder_id"]): int(row["responded_count"])
                for row in responded_rows
                if row.get("reminder_id") is not None
            }
    except Exception as exc:  # noqa: BLE001
        logger.error("Failed to load intake counts: %s", exc, exc_info=True)
    for reminder in reminders:
        reminder.confirmed_intake_count = confirmed_count_by_reminder_id.get(reminder.id, 0)
        reminder.responded_intake_count = responded_count_by_reminder_id.get(reminder.id, 0)
    return Response(
        ReminderListResponse(items=[_serialize(r) for r in reminders]).model_dump(),
        status_code=status.HTTP_200_OK,
    )


@reminder_router.patch("/{reminder_id}", response_model=ReminderResponse, status_code=status.HTTP_200_OK)
async def update_reminder(
    reminder_id: Annotated[str, Path(pattern=r"^\d+$")],
    data: MedicationReminderUpsertRequest,
    user: Annotated[User, Depends(get_request_user)],
    service: Annotated[ReminderService, Depends(ReminderService)],
) -> Response:
    reminder = await service.update_reminder(user=user, reminder_id=int(reminder_id), data=data)
    return Response(_serialize(reminder).model_dump(), status_code=status.HTTP_200_OK)


@reminder_router.delete("/{reminder_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_reminder(
    reminder_id: Annotated[str, Path(pattern=r"^\d+$")],
    user: Annotated[User, Depends(get_request_user)],
    service: Annotated[ReminderService, Depends(ReminderService)],
) -> StarletteResponse:
    await service.delete_reminder(user=user, reminder_id=int(reminder_id))
    return StarletteResponse(status_code=status.HTTP_204_NO_CONTENT)


@reminder_router.get("/medication-dday", response_model=DdayReminderListResponse, status_code=status.HTTP_200_OK)
async def get_medication_dday(
    user: Annotated[User, Depends(get_request_user)],
    service: Annotated[ReminderService, Depends(ReminderService)],
    days: Annotated[int, Query(ge=1)] = 7,
) -> Response:
    items = await service.get_dday_reminders(user=user, days=days)
    return Response(DdayReminderListResponse(items=items).model_dump(), status_code=status.HTTP_200_OK)
