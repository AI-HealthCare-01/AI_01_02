from tortoise.transactions import in_transaction

from app.core import config
from app.core.exceptions import AppException, ErrorCode
from app.dtos.guides import GuideJobCreateFromSnapshotRequest
from app.models.guides import GuideJob, GuideJobStatus, GuideResult
from app.models.ocr import OcrJobStatus
from app.models.users import User
from app.repositories.guide_repository import GuideRepository
from app.services.guide_automation import GuideAutomationService
from app.services.health_profiles import HealthProfileService
from app.services.ocr import OcrService


class GuideService:
    def __init__(self) -> None:
        self.repo = GuideRepository()
        self.guide_automation_service = GuideAutomationService()
        self.health_profile_service = HealthProfileService()
        self.ocr_service = OcrService()

    async def create_guide_job(self, *, user: User, ocr_job_id: int) -> GuideJob:
        profile = await self.health_profile_service.get_profile(user=user)
        if not profile:
            raise AppException(
                ErrorCode.STATE_CONFLICT,
                developer_message="건강 프로필이 없습니다. 온보딩 정보를 먼저 저장해주세요.",
            )
        required, _ = await self.guide_automation_service.is_profile_refresh_required_for_guide_generation(
            user_id=user.id
        )
        if required:
            raise AppException(
                ErrorCode.STATE_CONFLICT,
                developer_message="최근 가이드 생성 후 7일이 경과했습니다. 건강 프로필을 다시 입력한 뒤 가이드를 생성해주세요.",
            )

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

        if not await self.guide_automation_service.enqueue_or_fail(job, reason="create_guide_job"):
            raise AppException(ErrorCode.QUEUE_UNAVAILABLE, developer_message="가이드 작업 큐 등록에 실패했습니다.")

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
            raise AppException(ErrorCode.RESOURCE_NOT_FOUND, developer_message="가이드 작업을 찾을 수 없습니다.")
        return job

    async def get_latest_guide_job(self, *, user: User) -> GuideJob:
        job = await self.repo.get_latest_user_job(user_id=user.id)
        if not job:
            raise AppException(ErrorCode.RESOURCE_NOT_FOUND, developer_message="가이드 작업을 찾을 수 없습니다.")
        return job

    async def refresh_guide_job(self, *, user: User, job_id: int) -> GuideJob:
        required, _ = await self.guide_automation_service.is_profile_refresh_required_for_guide_generation(
            user_id=user.id
        )
        if required:
            raise AppException(
                ErrorCode.STATE_CONFLICT,
                developer_message="최근 가이드 생성 후 7일이 경과했습니다. 건강 프로필을 다시 입력한 뒤 가이드를 갱신해주세요.",
            )

        original_job = await self.get_guide_job(user=user, job_id=job_id)

        async with in_transaction():
            new_job = await self.repo.create_job(
                user_id=user.id,
                ocr_job_id=original_job.ocr_job_id,
                max_retries=config.GUIDE_JOB_MAX_RETRIES,
            )

        if not await self.guide_automation_service.enqueue_or_fail(new_job, reason="refresh_guide_job"):
            raise AppException(
                ErrorCode.QUEUE_UNAVAILABLE, developer_message="가이드 갱신 작업 큐 등록에 실패했습니다."
            )

        return new_job

    async def get_guide_result(self, *, user: User, job_id: int) -> GuideResult:
        job = await self.get_guide_job(user=user, job_id=job_id)
        if job.status != GuideJobStatus.SUCCEEDED:
            raise AppException(ErrorCode.STATE_CONFLICT, developer_message="가이드 작업이 아직 완료되지 않았습니다.")

        result = await GuideResult.get_or_none(job_id=job.id)
        if not result:
            raise AppException(ErrorCode.RESOURCE_NOT_FOUND, developer_message="가이드 결과를 찾을 수 없습니다.")
        return result
