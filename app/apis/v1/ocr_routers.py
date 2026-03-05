from typing import Annotated

from fastapi import APIRouter, Depends, File, Form, Path, Query, UploadFile, status
from fastapi.responses import ORJSONResponse as Response

from app.dependencies.security import get_request_user
from app.dtos.ocr import (
    DocumentUploadResponse,
    MedicationSearchItem,
    MedicationSearchResponse,
    OcrConfirmResponse,
    OcrJobCreateRequest,
    OcrJobCreateResponse,
    OcrJobResultResponse,
    OcrJobStatusResponse,
    OcrReviewConfirmRequest,
)
from app.models.ocr import DocumentType
from app.models.users import User
from app.services.medications import MedicationSearchService
from app.services.ocr import OcrService

ocr_router = APIRouter(prefix="/ocr", tags=["ocr"])
medication_router = APIRouter(prefix="/medications", tags=["medications"])


@ocr_router.post("/documents/upload", response_model=DocumentUploadResponse, status_code=status.HTTP_201_CREATED)
async def upload_document(
    user: Annotated[User, Depends(get_request_user)],
    ocr_service: Annotated[OcrService, Depends(OcrService)],
    document_type: Annotated[DocumentType, Form()],
    file: Annotated[UploadFile, File()],
) -> Response:
    document = await ocr_service.upload_document(user=user, document_type=document_type, file=file)
    return Response(
        DocumentUploadResponse(
            id=str(document.id),
            document_type=document.document_type,
            file_name=document.file_name,
            file_path=document.temp_storage_key,
            file_size=document.file_size,
            mime_type=document.mime_type,
            uploaded_at=document.uploaded_at,
        ).model_dump(),
        status_code=status.HTTP_201_CREATED,
    )


@ocr_router.post("/jobs", response_model=OcrJobCreateResponse, status_code=status.HTTP_202_ACCEPTED)
async def create_ocr_job(
    request: OcrJobCreateRequest,
    user: Annotated[User, Depends(get_request_user)],
    ocr_service: Annotated[OcrService, Depends(OcrService)],
) -> Response:
    job = await ocr_service.create_ocr_job(user=user, document_id=int(request.document_id))
    return Response(
        OcrJobCreateResponse(
            job_id=str(job.id),
            status=job.status,
            retry_count=job.retry_count,
            max_retries=job.max_retries,
            queued_at=job.queued_at,
        ).model_dump(),
        status_code=status.HTTP_202_ACCEPTED,
    )


@ocr_router.get("/jobs/{job_id}", response_model=OcrJobStatusResponse, status_code=status.HTTP_200_OK)
async def get_ocr_job_status(
    job_id: Annotated[str, Path(pattern=r"^\d+$")],
    user: Annotated[User, Depends(get_request_user)],
    ocr_service: Annotated[OcrService, Depends(OcrService)],
) -> Response:
    job = await ocr_service.get_ocr_job(user=user, job_id=int(job_id))
    return Response(
        OcrJobStatusResponse(
            job_id=str(job.id),
            document_id=str(job.document_id),
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
    job_id: Annotated[str, Path(pattern=r"^\d+$")],
    user: Annotated[User, Depends(get_request_user)],
    ocr_service: Annotated[OcrService, Depends(OcrService)],
) -> Response:
    result = await ocr_service.get_ocr_result(user=user, job_id=int(job_id))
    return Response(
        OcrJobResultResponse(
            job_id=str(result["job_id"]),
            extracted_text=result["extracted_text"],
            structured_data=result["structured_data"],
            created_at=result["created_at"],
            updated_at=result["updated_at"],
        ).model_dump(),
        status_code=status.HTTP_200_OK,
    )


@ocr_router.patch("/jobs/{job_id}/confirm", response_model=OcrConfirmResponse, status_code=status.HTTP_200_OK)
async def confirm_ocr_result(
    job_id: Annotated[str, Path(pattern=r"^\d+$")],
    request: OcrReviewConfirmRequest,
    user: Annotated[User, Depends(get_request_user)],
    ocr_service: Annotated[OcrService, Depends(OcrService)],
) -> Response:
    result = await ocr_service.confirm_ocr_result(
        user=user,
        job_id=int(job_id),
        confirmed=request.confirmed,
        corrected_medications=[m.model_dump(exclude_none=True) for m in request.corrected_medications],
        comment=request.comment,
    )
    structured = result.structured_data
    needs_review = bool(structured.get("needs_user_review", False))
    return Response(
        OcrConfirmResponse(
            job_id=str(result.job_id),
            extracted_text=result.extracted_text,
            structured_data=structured,
            needs_user_review=needs_review,
            created_at=result.created_at,
            updated_at=result.updated_at,
        ).model_dump(),
        status_code=status.HTTP_200_OK,
    )


@medication_router.get("/search", response_model=MedicationSearchResponse, status_code=status.HTTP_200_OK)
async def search_medications(
    user: Annotated[User, Depends(get_request_user)],
    service: Annotated[MedicationSearchService, Depends(MedicationSearchService)],
    q: Annotated[str, Query(min_length=1)],
    limit: Annotated[int, Query(ge=1, le=50)] = 10,
) -> Response:
    medications = await service.search(q=q, limit=limit)
    return Response(
        MedicationSearchResponse(
            items=[MedicationSearchItem(medication_id=str(m.id), name=m.name_ko) for m in medications]
        ).model_dump(),
        status_code=status.HTTP_200_OK,
    )
