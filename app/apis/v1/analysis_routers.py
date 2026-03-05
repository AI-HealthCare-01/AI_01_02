from datetime import date
from typing import Annotated, Any

from fastapi import APIRouter, Depends, Query, status
from fastapi.responses import ORJSONResponse as Response
from pydantic import BaseModel

from app.dependencies.security import get_request_user
from app.models.users import User
from app.services.analysis import AnalysisService

analysis_router = APIRouter(prefix="/analysis", tags=["analysis"])


class AnalysisSummaryResponse(BaseModel):
    basic_info: dict[str, Any]
    lifestyle_analysis: dict[str, Any]
    sleep_analysis: dict[str, Any]
    nutrition_analysis: dict[str, Any]
    risk_flags: list[dict[str, Any]]
    allergy_alerts: list[dict[str, Any]]
    emergency_alerts: list[dict[str, Any]]


@analysis_router.get("/summary", response_model=AnalysisSummaryResponse, status_code=status.HTTP_200_OK)
async def get_analysis_summary(
    user: Annotated[User, Depends(get_request_user)],
    service: Annotated[AnalysisService, Depends(AnalysisService)],
    date_from: Annotated[date | None, Query()] = None,
    date_to: Annotated[date | None, Query()] = None,
) -> Response:
    summary = await service.get_summary(user=user)
    return Response(AnalysisSummaryResponse(**summary).model_dump(), status_code=status.HTTP_200_OK)
