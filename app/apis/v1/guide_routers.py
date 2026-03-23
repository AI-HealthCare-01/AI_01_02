from typing import Annotated

from fastapi import APIRouter, Depends, Path, status
from fastapi.responses import ORJSONResponse as Response

from app.dependencies.security import get_request_user
from app.dtos.guides import (
    GuideFeedbackRequest,
    GuideFeedbackResponse,
    GuideFeedbackSummaryResponse,
    GuideJobCreateFromSnapshotRequest,
    GuideJobCreateRequest,
    GuideJobCreateResponse,
    GuideJobResultResponse,
    GuideJobStatusResponse,
    GuideRefreshResponse,
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
    job = await guide_service.create_guide_job(user=user, ocr_job_id=int(request.ocr_job_id))
    return Response(
        GuideJobCreateResponse(
            job_id=str(job.id),
            status=job.status,
            retry_count=job.retry_count,
            max_retries=job.max_retries,
            queued_at=job.queued_at,
        ).model_dump(),
        status_code=status.HTTP_202_ACCEPTED,
    )


@guide_router.post(
    "/jobs/confirm-and-create", response_model=GuideJobCreateResponse, status_code=status.HTTP_202_ACCEPTED
)
async def confirm_snapshot_and_create_guide_job(
    request: GuideJobCreateFromSnapshotRequest,
    user: Annotated[User, Depends(get_request_user)],
    guide_service: Annotated[GuideService, Depends(GuideService)],
) -> Response:
    job = await guide_service.create_guide_job_from_snapshot(user=user, request=request)
    return Response(
        GuideJobCreateResponse(
            job_id=str(job.id),
            status=job.status,
            retry_count=job.retry_count,
            max_retries=job.max_retries,
            queued_at=job.queued_at,
        ).model_dump(),
        status_code=status.HTTP_202_ACCEPTED,
    )


@guide_router.get("/jobs/latest", response_model=GuideJobStatusResponse, status_code=status.HTTP_200_OK)
async def get_latest_guide_job_status(
    user: Annotated[User, Depends(get_request_user)],
    guide_service: Annotated[GuideService, Depends(GuideService)],
) -> Response:
    job = await guide_service.get_latest_guide_job(user=user)
    return Response(
        GuideJobStatusResponse(
            job_id=str(job.id),
            ocr_job_id=str(job.ocr_job_id),
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


@guide_router.get("/jobs/{job_id}", response_model=GuideJobStatusResponse, status_code=status.HTTP_200_OK)
async def get_guide_job_status(
    job_id: Annotated[str, Path(pattern=r"^\d+$")],
    user: Annotated[User, Depends(get_request_user)],
    guide_service: Annotated[GuideService, Depends(GuideService)],
) -> Response:
    job = await guide_service.get_guide_job(user=user, job_id=int(job_id))
    return Response(
        GuideJobStatusResponse(
            job_id=str(job.id),
            ocr_job_id=str(job.ocr_job_id),
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
    job_id: Annotated[str, Path(pattern=r"^\d+$")],
    user: Annotated[User, Depends(get_request_user)],
    guide_service: Annotated[GuideService, Depends(GuideService)],
) -> Response:
    result = await guide_service.get_guide_result(user=user, job_id=int(job_id))
    return Response(
        GuideJobResultResponse(
            job_id=str(result.job_id),
            medication_guidance=result.medication_guidance,
            lifestyle_guidance=result.lifestyle_guidance,
            risk_level=result.risk_level,
            safety_notice=result.safety_notice,
            source_references=result.structured_data.get("source_references", []),
            adherence_rate_percent=result.structured_data.get("adherence_rate_percent"),
            personalized_guides=result.structured_data.get("personalized_guides"),
            source_attributions=result.structured_data.get("source_attributions"),
            weekly_adherence_rate=result.structured_data.get("weekly_adherence_rate"),
            structured_data=result.structured_data,
            created_at=result.created_at,
            updated_at=result.updated_at,
        ).model_dump(),
        status_code=status.HTTP_200_OK,
    )


@guide_router.post(
    "/jobs/{job_id}/refresh",
    response_model=GuideRefreshResponse,
    status_code=status.HTTP_202_ACCEPTED,
)
async def refresh_guide_job(
    job_id: Annotated[str, Path(pattern=r"^\d+$")],
    user: Annotated[User, Depends(get_request_user)],
    guide_service: Annotated[GuideService, Depends(GuideService)],
) -> Response:
    new_job = await guide_service.refresh_guide_job(user=user, job_id=int(job_id))
    return Response(
        GuideRefreshResponse(
            refreshed_job_id=str(new_job.id),
            status=new_job.status,
        ).model_dump(),
        status_code=status.HTTP_202_ACCEPTED,
    )


@guide_router.post(
    "/jobs/{job_id}/feedback",
    response_model=GuideFeedbackResponse,
    status_code=status.HTTP_201_CREATED,
)
async def submit_guide_feedback(
    job_id: Annotated[str, Path(pattern=r"^\d+$")],
    request: GuideFeedbackRequest,
    user: Annotated[User, Depends(get_request_user)],
    guide_service: Annotated[GuideService, Depends(GuideService)],
) -> Response:
    feedback = await guide_service.submit_feedback(user=user, job_id=int(job_id), request=request)
    return Response(
        GuideFeedbackResponse(
            id=str(feedback.id),
            guide_job_id=str(feedback.guide_job_id),
            rating=feedback.rating,
            is_helpful=feedback.is_helpful,
            comment=feedback.comment,
            created_at=feedback.created_at,
        ).model_dump(),
        status_code=status.HTTP_201_CREATED,
    )


@guide_router.get(
    "/feedback/summary",
    response_model=list[GuideFeedbackSummaryResponse],
    status_code=status.HTTP_200_OK,
)
async def get_guide_feedback_summary(
    user: Annotated[User, Depends(get_request_user)],
    guide_service: Annotated[GuideService, Depends(GuideService)],
) -> Response:
    if not user.is_admin:
        from app.core.exceptions import AppException, ErrorCode

        raise AppException(ErrorCode.AUTH_FORBIDDEN, developer_message="관리자만 접근할 수 있습니다.")
    summaries = await guide_service.get_feedback_summary()
    return Response(
        [s.model_dump() for s in summaries],
        status_code=status.HTTP_200_OK,
    )
