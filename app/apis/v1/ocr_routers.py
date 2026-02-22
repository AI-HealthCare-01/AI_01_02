from typing import Annotated

from fastapi import APIRouter, Depends, File, Form, UploadFile, status
from fastapi.responses import ORJSONResponse as Response

from app.dependencies.security import get_request_user
from app.dtos.ocr import (
    DocumentUploadResponse,
    OcrJobCreateRequest,
    OcrJobCreateResponse,
    OcrJobResultResponse,
    OcrJobStatusResponse,
)
from app.models.ocr import DocumentType
from app.models.users import User
from app.services.ocr import OcrService

ocr_router = APIRouter(prefix="/ocr", tags=["ocr"])


@ocr_router.post("/documents/upload", response_model=DocumentUploadResponse, status_code=status.HTTP_201_CREATED)
async def upload_document(
    user: Annotated[User, Depends(get_request_user)],
    ocr_service: Annotated[OcrService, Depends(OcrService)],
    document_type: Annotated[DocumentType, Form()],
    file: Annotated[UploadFile, File()],
) -> Response:
    document = await ocr_service.upload_document(user=user, document_type=document_type, file=file)
    return Response(DocumentUploadResponse.model_validate(document).model_dump(), status_code=status.HTTP_201_CREATED)


@ocr_router.post("/jobs", response_model=OcrJobCreateResponse, status_code=status.HTTP_202_ACCEPTED)
async def create_ocr_job(
    request: OcrJobCreateRequest,
    user: Annotated[User, Depends(get_request_user)],
    ocr_service: Annotated[OcrService, Depends(OcrService)],
) -> Response:
    job = await ocr_service.create_ocr_job(user=user, document_id=request.document_id)
    return Response(
        OcrJobCreateResponse(
            job_id=job.id,
            status=job.status,
            retry_count=job.retry_count,
            max_retries=job.max_retries,
            queued_at=job.queued_at,
        ).model_dump(),
        status_code=status.HTTP_202_ACCEPTED,
    )


@ocr_router.get("/jobs/{job_id}", response_model=OcrJobStatusResponse, status_code=status.HTTP_200_OK)
async def get_ocr_job_status(
    job_id: int,
    user: Annotated[User, Depends(get_request_user)],
    ocr_service: Annotated[OcrService, Depends(OcrService)],
) -> Response:
    job = await ocr_service.get_ocr_job(user=user, job_id=job_id)
    return Response(
        OcrJobStatusResponse(
            job_id=job.id,
            document_id=job.document_id,
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


@ocr_router.get("/jobs/{job_id}/result", response_model=OcrJobResultResponse, status_code=status.HTTP_200_OK)
async def get_ocr_job_result(
    job_id: int,
    user: Annotated[User, Depends(get_request_user)],
    ocr_service: Annotated[OcrService, Depends(OcrService)],
) -> Response:
    result = await ocr_service.get_ocr_result(user=user, job_id=job_id)
    return Response(
        OcrJobResultResponse(
            job_id=result.job_id,
            extracted_text=result.extracted_text,
            structured_data=result.structured_data,
            created_at=result.created_at,
            updated_at=result.updated_at,
        ).model_dump(),
        status_code=status.HTTP_200_OK,
    )
