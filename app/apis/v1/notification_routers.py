from typing import Annotated

from fastapi import APIRouter, Depends, Path, Query, status
from fastapi.responses import ORJSONResponse as Response

from app.dependencies.security import get_request_user
from app.dtos.notifications import (
    NotificationInfoResponse,
    NotificationListResponse,
    ReadAllNotificationsResponse,
    UnreadCountResponse,
)
from app.models.notifications import Notification
from app.models.users import User
from app.services.notifications import NotificationService

notification_router = APIRouter(prefix="/notifications", tags=["notifications"])


def _serialize_notification(notification: Notification) -> NotificationInfoResponse:
    return NotificationInfoResponse(
        id=str(notification.id),
        type=notification.type,
        title=notification.title,
        message=notification.message,
        is_read=notification.is_read,
        read_at=notification.read_at,
        payload=notification.payload,
        created_at=notification.created_at,
    )


@notification_router.get("", response_model=NotificationListResponse, status_code=status.HTTP_200_OK)
async def list_notifications(
    user: Annotated[User, Depends(get_request_user)],
    notification_service: Annotated[NotificationService, Depends(NotificationService)],
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
    offset: Annotated[int, Query(ge=0)] = 0,
    is_read: Annotated[bool | None, Query()] = None,
) -> Response:
    notifications, unread_count = await notification_service.list_notifications(
        user=user,
        limit=limit,
        offset=offset,
        is_read=is_read,
    )
    return Response(
        NotificationListResponse(
            items=[_serialize_notification(notification) for notification in notifications],
            unread_count=unread_count,
        ).model_dump(),
        status_code=status.HTTP_200_OK,
    )


@notification_router.get("/unread-count", response_model=UnreadCountResponse, status_code=status.HTTP_200_OK)
async def get_unread_count(
    user: Annotated[User, Depends(get_request_user)],
    notification_service: Annotated[NotificationService, Depends(NotificationService)],
) -> Response:
    unread_count = await notification_service.get_unread_count(user=user)
    return Response(UnreadCountResponse(unread_count=unread_count).model_dump(), status_code=status.HTTP_200_OK)


@notification_router.patch(
    "/{notification_id}/read", response_model=NotificationInfoResponse, status_code=status.HTTP_200_OK
)
async def mark_notification_as_read(
    notification_id: Annotated[str, Path(pattern=r"^\d+$")],
    user: Annotated[User, Depends(get_request_user)],
    notification_service: Annotated[NotificationService, Depends(NotificationService)],
) -> Response:
    notification = await notification_service.mark_as_read(user=user, notification_id=int(notification_id))
    return Response(_serialize_notification(notification).model_dump(), status_code=status.HTTP_200_OK)


@notification_router.patch("/read-all", response_model=ReadAllNotificationsResponse, status_code=status.HTTP_200_OK)
async def mark_all_notifications_as_read(
    user: Annotated[User, Depends(get_request_user)],
    notification_service: Annotated[NotificationService, Depends(NotificationService)],
) -> Response:
    updated_count = await notification_service.mark_all_as_read(user=user)
    return Response(
        ReadAllNotificationsResponse(updated_count=updated_count).model_dump(), status_code=status.HTTP_200_OK
    )
