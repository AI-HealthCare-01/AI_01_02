import os
from pathlib import Path
from typing import Annotated

from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, Query, UploadFile, status
from fastapi import Path as PathParam
from fastapi.responses import ORJSONResponse as Response

from app.core import config
from app.core.exceptions import AppException, ErrorCode
from app.core.logger import default_logger as logger
from app.dependencies.security import get_request_user
from app.dtos.ocr import (
    DocumentUploadResponse,
    MedicationInfoResponse,
    MedicationSearchItem,
    MedicationSearchResponse,
    OcrConfirmResponse,
    OcrJobCreateRequest,
    OcrJobCreateResponse,
    OcrJobResultResponse,
    OcrJobStatusResponse,
    OcrResultConfirmRequest,
    OcrReviewConfirmRequest,
)
from app.models.ocr import DocumentType
from app.models.users import User
from app.services.medications import MedicationInfoService, MedicationSearchService
from app.services.ocr import OcrService

ocr_router = APIRouter(prefix="/ocr", tags=["ocr"])
medication_router = APIRouter(prefix="/medications", tags=["medications"])


def delete_file_securely(file_path: str):
    """보안을 위한 원본 파일 즉시 삭제 (BackgroundTasks 호출용)"""
    try:
        os.remove(file_path)
        logger.info("원본 파일 삭제 완료: %s", file_path)
    except FileNotFoundError:
        logger.debug("파일이 이미 삭제됨: %s", file_path)
    except OSError as e:
        logger.warning("임시 파일 삭제 실패: %s", e)


@ocr_router.post("/documents/upload", response_model=DocumentUploadResponse, status_code=status.HTTP_201_CREATED)
async def upload_document(
    user: Annotated[User, Depends(get_request_user)],
    ocr_service: Annotated[OcrService, Depends(OcrService)],
    document_type: Annotated[DocumentType, Form()],
    file: Annotated[UploadFile, File()],
) -> Response:
    # 1. 확장자 검증
    if not file.filename:
        raise AppException(ErrorCode.VALIDATION_ERROR, developer_message="파일명이 필요합니다.")

    ext = file.filename.split(".")[-1].lower() if "." in file.filename else ""
    if ext not in config.OCR_ALLOWED_EXTENSIONS:
        raise AppException(ErrorCode.FILE_INVALID_TYPE)

    # 2. 파일 크기 검증 (FastAPI UploadFile.size 지원 시 사용, 아니면 content-length 활용 가능)
    # 10MB = 10 * 1024 * 1024 bytes
    if file.size and file.size > config.OCR_MAX_FILE_SIZE_BYTES:
        raise AppException(ErrorCode.FILE_TOO_LARGE)

    document = await ocr_service.upload_document(user=user, document_type=document_type, file=file)
    return Response(
        DocumentUploadResponse(
            id=str(document.id),
            document_type=document.document_type,
            file_name=document.file_name,
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
    job_id: Annotated[str, PathParam(pattern=r"^\d+$")],
    user: Annotated[User, Depends(get_request_user)],
    ocr_service: Annotated[OcrService, Depends(OcrService)],
    background_tasks: BackgroundTasks,
) -> Response:
    result = await ocr_service.get_ocr_result(user=user, job_id=int(job_id))

    # Re-fetch document info for secure deletion from router as a safeguard
    job = await ocr_service.get_ocr_job(user=user, job_id=int(job_id))
    if job:
        await job.fetch_related("document")
        if job.document:
            abs_path = os.path.join(config.MEDIA_DIR, job.document.temp_storage_key)
            background_tasks.add_task(delete_file_securely, abs_path)

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
    result = await ocr_service.confirm_ocr_review(
        user=user,
        job_id=int(job_id),
        confirmed=request.confirmed,
        corrected_medications=[m.model_dump(exclude_none=True) for m in request.corrected_medications],
        comment=request.comment,
    )
    structured = result.confirmed_result if isinstance(result.confirmed_result, dict) else {}
    if not structured:
        structured = result.structured_result if isinstance(result.structured_result, dict) else {}
    return Response(
        OcrConfirmResponse(
            job_id=str(result.id),
            extracted_text=result.raw_text or "",
            structured_data=structured,
            needs_user_review=result.needs_user_review,
            created_at=result.created_at,
            updated_at=result.updated_at,
        ).model_dump(),
        status_code=status.HTTP_200_OK,
    )


@ocr_router.put("/jobs/{job_id}/result/confirm", response_model=OcrJobResultResponse, status_code=status.HTTP_200_OK)
async def confirm_ocr_job_result(
    job_id: Annotated[str, Path(pattern=r"^\d+$")],
    request: OcrResultConfirmRequest,
    user: Annotated[User, Depends(get_request_user)],
    ocr_service: Annotated[OcrService, Depends(OcrService)],
) -> Response:
    result = await ocr_service.confirm_ocr_result(user=user, job_id=int(job_id), request=request)
    structured = result.confirmed_result if isinstance(result.confirmed_result, dict) else {}
    if not structured:
        structured = result.structured_result if isinstance(result.structured_result, dict) else {}
    return Response(
        OcrJobResultResponse(
            job_id=str(result.id),
            extracted_text=result.raw_text or "",
            structured_data=structured,
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


@medication_router.get("/info", response_model=MedicationInfoResponse, status_code=status.HTTP_200_OK)
async def get_medication_info(
    user: Annotated[User, Depends(get_request_user)],
    service: Annotated[MedicationInfoService, Depends(MedicationInfoService)],
    name: Annotated[str, Query(min_length=1)],
) -> Response:
    info = await service.get_info(name=name)
    if not info:
        return Response(MedicationInfoResponse().model_dump(), status_code=status.HTTP_200_OK)
    return Response(MedicationInfoResponse(**info).model_dump(), status_code=status.HTTP_200_OK)
