from tortoise.exceptions import IntegrityError
from tortoise.transactions import in_transaction

from app.core import config
from app.core.exceptions import AppException, ErrorCode
from app.core.logger import default_logger as logger
from app.dtos.guides import GuideFeedbackRequest, GuideFeedbackSummaryResponse, GuideJobCreateFromSnapshotRequest
from app.models.guides import GuideFeedback, GuideJob, GuideJobStatus, GuideResult
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

    # ── Feedback ──────────────────────────────────────

    async def submit_feedback(self, *, user: User, job_id: int, request: GuideFeedbackRequest) -> GuideFeedback:
        job = await self.get_guide_job(user=user, job_id=job_id)
        if job.status != GuideJobStatus.SUCCEEDED:
            raise AppException(
                ErrorCode.STATE_CONFLICT, developer_message="완료된 가이드에만 피드백을 남길 수 있습니다."
            )

        existing = await GuideFeedback.get_or_none(guide_job_id=job.id, user_id=user.id)
        if existing:
            raise AppException(ErrorCode.STATE_CONFLICT, developer_message="이미 이 가이드에 피드백을 남겼습니다.")

        result = await GuideResult.get_or_none(job_id=job.id)
        if not result:
            logger.warning("SUCCEEDED guide job %d has no GuideResult — prompt_version will be empty", job.id)
        raw_version = result.structured_data.get("prompt_version", "") if result else ""
        prompt_version = str(raw_version)[:20] if raw_version else ""

        try:
            feedback = await GuideFeedback.create(
                guide_job_id=job.id,
                user_id=user.id,
                rating=request.rating,
                is_helpful=request.is_helpful,
                comment=request.comment,
                prompt_version=prompt_version,
            )
        except IntegrityError as exc:
            raise AppException(
                ErrorCode.STATE_CONFLICT, developer_message="이미 이 가이드에 피드백을 남겼습니다."
            ) from exc
        return feedback

    async def get_feedback_summary(self) -> list[GuideFeedbackSummaryResponse]:
        """프롬프트 버전별 피드백 통계를 반환한다.

        피드백 개선 파이프라인:
        1. GuideFeedback 테이블에서 prompt_version별 평균 평점 집계
        2. 평균 평점 < 3.0인 버전 → 프롬프트 수정 트리거 (운영팀 알림)
        3. 주간 갱신 시 최신 프롬프트 버전으로 재생성
        """
        from tortoise.functions import Avg, Count

        rows = (
            await GuideFeedback.all()
            .group_by("prompt_version")
            .annotate(
                total_count=Count("id"),
                avg_rating=Avg("rating"),
            )
            .values("prompt_version", "total_count", "avg_rating")
        )

        summaries: list[GuideFeedbackSummaryResponse] = []
        for row in rows:
            version = row["prompt_version"] or "unknown"
            total = row["total_count"]
            helpful_count = await GuideFeedback.filter(prompt_version=row["prompt_version"], is_helpful=True).count()
            summaries.append(
                GuideFeedbackSummaryResponse(
                    prompt_version=version,
                    total_count=total,
                    average_rating=round(float(row["avg_rating"] or 0), 2),
                    helpful_rate=round(helpful_count / total, 2) if total else 0.0,
                )
            )
        return summaries
