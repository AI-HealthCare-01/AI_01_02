from fastapi import APIRouter, status
from fastapi.responses import ORJSONResponse as Response

notification_router_v2 = APIRouter(prefix="/notifications", tags=["notifications-v2"])


@notification_router_v2.get("/capabilities", status_code=status.HTTP_200_OK)
async def get_notification_v2_capabilities() -> Response:
    return Response(
        {
            "version": "v2",
            "status": "planned",
            "features": ["user-preferences", "event-driven-publish", "real-time-delivery"],
        },
        status_code=status.HTTP_200_OK,
    )
