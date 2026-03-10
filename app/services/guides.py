from datetime import datetime

from tortoise.transactions import in_transaction

from app.core import config, default_logger
from app.core.exceptions import AppException, ErrorCode
from app.models.guides import GuideFailureCode, GuideJob, GuideJobStatus, GuideResult
from app.models.ocr import OcrJobStatus
from app.models.users import User
from app.repositories.guide_repository import GuideRepository
from app.services.guide_queue import GuideQueuePublisher


class GuideService:
    def __init__(self) -> None:
        self.repo = GuideRepository()
        self.queue_publisher = GuideQueuePublisher()

    async def create_guide_job(self, *, user: User, ocr_job_id: int) -> GuideJob:
        ocr_job = await self.repo.get_user_ocr_job(ocr_job_id=ocr_job_id, user_id=user.id)
        if not ocr_job:
            raise AppException(ErrorCode.RESOURCE_NOT_FOUND, developer_message="OCR 작업을 찾을 수 없습니다.")

        if ocr_job.status != OcrJobStatus.SUCCEEDED:
            raise AppException(ErrorCode.STATE_CONFLICT, developer_message="OCR 작업이 아직 완료되지 않았습니다.")

        async with in_transaction():
            job = await self.repo.create_job(
                user_id=user.id,
                ocr_job_id=ocr_job_id,
                max_retries=config.GUIDE_JOB_MAX_RETRIES,
            )

        try:
            await self.queue_publisher.enqueue_job(job.id)
        except RuntimeError as err:
            failed_at = datetime.now(config.TIMEZONE)
            await GuideJob.filter(id=job.id, status=GuideJobStatus.QUEUED).update(
                status=GuideJobStatus.FAILED,
                failure_code=GuideFailureCode.PROCESSING_ERROR,
                error_message="[PROCESSING_ERROR] guide queue publish failed.",
                completed_at=failed_at,
            )
            default_logger.exception("guide queue publish failed (job_id=%s)", job.id)
            raise AppException(
                ErrorCode.QUEUE_UNAVAILABLE, developer_message="가이드 작업 큐 등록에 실패했습니다."
            ) from err

        return job

    async def get_guide_job(self, *, user: User, job_id: int) -> GuideJob:
        job = await self.repo.get_user_job(job_id=job_id, user_id=user.id)
        if not job:
            raise AppException(ErrorCode.RESOURCE_NOT_FOUND, developer_message="가이드 작업을 찾을 수 없습니다.")
        return job

    async def refresh_guide_job(self, *, user: User, job_id: int) -> GuideJob:
        original_job = await self.get_guide_job(user=user, job_id=job_id)

        async with in_transaction():
            new_job = await self.repo.create_job(
                user_id=user.id,
                ocr_job_id=original_job.ocr_job_id,
                max_retries=config.GUIDE_JOB_MAX_RETRIES,
            )

        try:
            await self.queue_publisher.enqueue_job(new_job.id)
        except RuntimeError as err:
            failed_at = datetime.now(config.TIMEZONE)
            await GuideJob.filter(id=new_job.id, status=GuideJobStatus.QUEUED).update(
                status=GuideJobStatus.FAILED,
                failure_code=GuideFailureCode.PROCESSING_ERROR,
                error_message="[PROCESSING_ERROR] guide queue publish failed.",
                completed_at=failed_at,
            )
            default_logger.exception("guide refresh queue publish failed (job_id=%s)", new_job.id)
            raise AppException(
                ErrorCode.QUEUE_UNAVAILABLE, developer_message="가이드 갱신 작업 큐 등록에 실패했습니다."
            ) from err

        return new_job

    async def get_guide_result(self, *, user: User, job_id: int) -> GuideResult:
        job = await self.get_guide_job(user=user, job_id=job_id)
        if job.status != GuideJobStatus.SUCCEEDED:
            raise AppException(ErrorCode.STATE_CONFLICT, developer_message="가이드 작업이 아직 완료되지 않았습니다.")

        result = await GuideResult.get_or_none(job_id=job.id)
        if not result:
            raise AppException(ErrorCode.RESOURCE_NOT_FOUND, developer_message="가이드 결과를 찾을 수 없습니다.")
        return result
