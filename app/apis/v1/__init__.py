from fastapi import APIRouter

from app.apis.v1.analysis_routers import analysis_router
from app.apis.v1.auth_routers import auth_router
from app.apis.v1.chat_routers import chat_router
from app.apis.v1.diary_routers import diary_router
from app.apis.v1.drug_routers import drug_router
from app.apis.v1.guide_routers import guide_router
from app.apis.v1.notification_routers import notification_router
from app.apis.v1.ocr_routers import medication_router, ocr_router
from app.apis.v1.reminder_routers import reminder_router
from app.apis.v1.schedule_routers import schedule_router
from app.apis.v1.user_routers import user_router
from app.core import config
from app.core.config import Env

v1_routers = APIRouter(prefix="/api/v1")
v1_routers.include_router(analysis_router)
v1_routers.include_router(auth_router)
v1_routers.include_router(chat_router)
v1_routers.include_router(diary_router)
if config.ENV != Env.PROD:
    from app.apis.v1.dev_routers import dev_router

    v1_routers.include_router(dev_router)
v1_routers.include_router(drug_router)
v1_routers.include_router(guide_router)
v1_routers.include_router(medication_router)
v1_routers.include_router(notification_router)
v1_routers.include_router(ocr_router)
v1_routers.include_router(reminder_router)
v1_routers.include_router(schedule_router)
v1_routers.include_router(user_router)
