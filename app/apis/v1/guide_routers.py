from typing import Annotated

from fastapi import APIRouter, Depends, status
from fastapi.responses import ORJSONResponse as Response

from app.dependencies.security import get_request_user
from app.dtos.guides import (
    GuideJobCreateRequest,
    GuideJobCreateResponse,
    GuideJobResultResponse,
    GuideJobStatusResponse,
)
from app.models.users import User
from app.services.guides import GuideService

guide_router = APIRouter(prefix="/guides", tags=["guides"])


@guide_router.post("/jobs", response_model=GuideJobCreateResponse, status_code=status.HTTP_202_ACCEPTED)
async def create_guide_job(
    request: GuideJobCreateRequest,
    user: Annotated[User, Depends(get_request_user)],
    guide_service: Annotated[GuideService, Depends(GuideService)],
) -> Response:
    job = await guide_service.create_guide_job(user=user, ocr_job_id=request.ocr_job_id)
    return Response(
        GuideJobCreateResponse(
            job_id=job.id,
            status=job.status,
            retry_count=job.retry_count,
            max_retries=job.max_retries,
            queued_at=job.queued_at,
        ).model_dump(),
        status_code=status.HTTP_202_ACCEPTED,
    )


@guide_router.get("/jobs/{job_id}", response_model=GuideJobStatusResponse, status_code=status.HTTP_200_OK)
async def get_guide_job_status(
    job_id: int,
    user: Annotated[User, Depends(get_request_user)],
    guide_service: Annotated[GuideService, Depends(GuideService)],
) -> Response:
    job = await guide_service.get_guide_job(user=user, job_id=job_id)
    return Response(
        GuideJobStatusResponse(
            job_id=job.id,
            ocr_job_id=job.ocr_job_id,
            status=job.status,
            retry_count=job.retry_count,
            max_retries=job.max_retries,
            failure_code=job.failure_code,
            error_message=job.error_message,
            queued_at=job.queued_at,
            started_at=job.started_at,
            completed_at=job.completed_at,
        ).model_dump(),
        status_code=status.HTTP_200_OK,
    )


@guide_router.get("/jobs/{job_id}/result", response_model=GuideJobResultResponse, status_code=status.HTTP_200_OK)
async def get_guide_job_result(
    job_id: int,
    user: Annotated[User, Depends(get_request_user)],
    guide_service: Annotated[GuideService, Depends(GuideService)],
) -> Response:
    result = await guide_service.get_guide_result(user=user, job_id=job_id)
    return Response(
        GuideJobResultResponse(
            job_id=result.job_id,
            medication_guidance=result.medication_guidance,
            lifestyle_guidance=result.lifestyle_guidance,
            risk_level=result.risk_level,
            safety_notice=result.safety_notice,
            structured_data=result.structured_data,
            created_at=result.created_at,
            updated_at=result.updated_at,
        ).model_dump(),
        status_code=status.HTTP_200_OK,
    )
