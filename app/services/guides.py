from datetime import datetime

from fastapi import HTTPException, status
from tortoise.transactions import in_transaction

from app.core import config, default_logger
from app.dtos.guides import GuideJobCreateFromSnapshotRequest
from app.models.guides import GuideFailureCode, GuideJob, GuideJobStatus, GuideResult
from app.models.ocr import OcrJobStatus
from app.models.users import User
from app.repositories.guide_repository import GuideRepository
from app.services.health_profiles import HealthProfileService
from app.services.ocr import OcrService
from app.services.guide_queue import GuideQueuePublisher


class GuideService:
    def __init__(self) -> None:
        self.repo = GuideRepository()
        self.queue_publisher = GuideQueuePublisher()
        self.health_profile_service = HealthProfileService()
        self.ocr_service = OcrService()

    async def create_guide_job(self, *, user: User, ocr_job_id: int) -> GuideJob:
        profile = await self.health_profile_service.get_profile(user=user)
        if not profile:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="건강 프로필이 없습니다. 온보딩 정보를 먼저 저장해주세요.",
            )
        if self.health_profile_service.is_onboarding_expired(profile):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="온보딩 유효기간(7일)이 만료되었습니다. 최신 정보를 다시 입력해주세요.",
            )

        ocr_job = await self.repo.get_user_ocr_job(ocr_job_id=ocr_job_id, user_id=user.id)
        if not ocr_job:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="OCR 작업을 찾을 수 없습니다.")

        if ocr_job.status != OcrJobStatus.SUCCEEDED:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="OCR 작업이 아직 완료되지 않았습니다.")

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
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="가이드 작업 큐 등록에 실패했습니다. 잠시 후 다시 시도해주세요.",
            ) from err

        return job

    async def create_guide_job_from_snapshot(
        self,
        *,
        user: User,
        request: GuideJobCreateFromSnapshotRequest,
    ) -> GuideJob:
        await self.health_profile_service.upsert_profile(user=user, request=request.health_profile)
        await self.ocr_service.confirm_ocr_result(user=user, job_id=int(request.ocr_job_id), request=request.ocr_result)
        return await self.create_guide_job(user=user, ocr_job_id=int(request.ocr_job_id))

    async def get_guide_job(self, *, user: User, job_id: int) -> GuideJob:
        job = await self.repo.get_user_job(job_id=job_id, user_id=user.id)
        if not job:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="가이드 작업을 찾을 수 없습니다.")
        return job

    async def get_guide_result(self, *, user: User, job_id: int) -> GuideResult:
        job = await self.get_guide_job(user=user, job_id=job_id)
        if job.status != GuideJobStatus.SUCCEEDED:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="가이드 작업이 아직 완료되지 않았습니다.")

        result = await GuideResult.get_or_none(job_id=job.id)
        if not result:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="가이드 결과를 찾을 수 없습니다.")
        return result
