from fastapi import APIRouter

from app.apis.v2.notification_routers import notification_router_v2

v2_routers = APIRouter(prefix="/api/v2")
v2_routers.include_router(notification_router_v2)
