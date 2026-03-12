from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends, Query, status
from fastapi.responses import ORJSONResponse as Response

from app.dependencies.security import get_request_user
from app.dtos.analysis import AnalysisSummaryResponse
from app.models.users import User
from app.services.analysis import AnalysisService

analysis_router = APIRouter(prefix="/analysis", tags=["analysis"])


@analysis_router.get("/summary", response_model=AnalysisSummaryResponse, status_code=status.HTTP_200_OK)
async def get_analysis_summary(
    user: Annotated[User, Depends(get_request_user)],
    service: Annotated[AnalysisService, Depends(AnalysisService)],
    date_from: Annotated[date | None, Query()] = None,
    date_to: Annotated[date | None, Query()] = None,
) -> Response:
    summary = await service.get_summary(user=user, date_from=date_from, date_to=date_to)
    return Response(AnalysisSummaryResponse(**summary).model_dump(), status_code=status.HTTP_200_OK)
