from pathlib import Path

from fastapi import APIRouter, status
from fastapi.responses import FileResponse

dev_router = APIRouter(prefix="/dev", tags=["dev"])

TEMPLATE_DIR = Path(__file__).resolve().parents[2] / "templates"
NOTIFICATION_PLAYGROUND_FILE = TEMPLATE_DIR / "notification_playground.html"


@dev_router.get("/notifications-playground", status_code=status.HTTP_200_OK)
async def notifications_playground() -> FileResponse:
    return FileResponse(path=NOTIFICATION_PLAYGROUND_FILE)
