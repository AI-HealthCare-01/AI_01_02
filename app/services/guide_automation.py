from datetime import datetime, timedelta

from redis.asyncio import Redis
from redis.exceptions import RedisError

from app.core import config, default_logger
from app.models.guides import GuideFailureCode, GuideFeedback, GuideJob, GuideJobStatus
from app.models.health_profiles import UserHealthProfile
from app.models.notifications import Notification, NotificationType
from app.models.ocr import OcrJob, OcrJobStatus
from app.services.guide_queue import GuideQueuePublisher

_redis_client: Redis | None = None


def _get_redis_client() -> Redis:
    global _redis_client
    if _redis_client is None:
        _redis_client = Redis(
            host=config.REDIS_HOST,
            port=config.REDIS_PORT,
            db=config.REDIS_DB,
            password=config.REDIS_PASSWORD,
            decode_responses=True,
            socket_connect_timeout=config.REDIS_SOCKET_TIMEOUT_SECONDS,
            socket_timeout=config.REDIS_SOCKET_TIMEOUT_SECONDS,
        )
    return _redis_client


class GuideAutomationService:
    def __init__(self) -> None:
        self.queue_publisher = GuideQueuePublisher()

    async def _get_latest_succeeded_guide_job(self, *, user_id: int) -> GuideJob | None:
        return (
            await GuideJob.filter(user_id=user_id, status=GuideJobStatus.SUCCEEDED)
            .order_by("-completed_at", "-id")
            .first()
        )

    async def is_profile_refresh_required_for_guide_generation(self, *, user_id: int) -> tuple[bool, int | None]:
        latest_succeeded_guide = await self._get_latest_succeeded_guide_job(user_id=user_id)
        if not latest_succeeded_guide or not latest_succeeded_guide.completed_at:
            return False, None

        cutoff = datetime.now(config.TIMEZONE) - timedelta(days=7)
        if latest_succeeded_guide.completed_at > cutoff:
            return False, latest_succeeded_guide.id

        profile = await UserHealthProfile.get_or_none(user_id=user_id)
        if not profile:
            return True, latest_succeeded_guide.id

        if profile.updated_at <= latest_succeeded_guide.completed_at:
            return True, latest_succeeded_guide.id
        return False, latest_succeeded_guide.id

    async def _get_latest_succeeded_ocr_job(self, *, user_id: int) -> OcrJob | None:
        return (
            await OcrJob.filter(user_id=user_id, status=OcrJobStatus.SUCCEEDED).order_by("-completed_at", "-id").first()
        )

    async def _has_pending_guide_job_for_ocr(self, *, user_id: int, ocr_job_id: int) -> bool:
        count = await GuideJob.filter(
            user_id=user_id,
            ocr_job_id=ocr_job_id,
            status__in=[GuideJobStatus.QUEUED, GuideJobStatus.PROCESSING],
        ).count()
        return count > 0

    async def _create_weekly_refresh_required_notification(self, *, user_id: int, source_guide_job_id: int) -> None:
        existing = await Notification.filter(
            user_id=user_id,
            type=NotificationType.HEALTH_ALERT,
        ).only("id", "payload")
        for notification in existing:
            payload = notification.payload if isinstance(notification.payload, dict) else {}
            if (
                payload.get("event") == "guide_weekly_refresh_required"
                and int(payload.get("source_guide_job_id") or 0) == source_guide_job_id
            ):
                return
        await Notification.create(
            user_id=user_id,
            type=NotificationType.HEALTH_ALERT,
            title="주간 건강정보 재입력 필요",
            message="가이드 생성 후 7일이 지났습니다. 최신 키/몸무게/생활습관/수면/식사 정보를 다시 입력해 주세요.",
            payload={
                "event": "guide_weekly_refresh_required",
                "source_guide_job_id": source_guide_job_id,
            },
        )

    async def notify_weekly_refresh_if_due(self, *, user_id: int) -> bool:
        required, source_guide_job_id = await self.is_profile_refresh_required_for_guide_generation(user_id=user_id)
        if not required or source_guide_job_id is None:
            return False
        await self._create_weekly_refresh_required_notification(
            user_id=user_id, source_guide_job_id=source_guide_job_id
        )
        return True

    async def trigger_refresh_with_latest_ocr(self, *, user_id: int, reason: str) -> GuideJob | None:
        required, source_guide_job_id = await self.is_profile_refresh_required_for_guide_generation(user_id=user_id)
        if required:
            if source_guide_job_id is not None:
                await self._create_weekly_refresh_required_notification(
                    user_id=user_id,
                    source_guide_job_id=source_guide_job_id,
                )
            return None

        latest_ocr_job = await self._get_latest_succeeded_ocr_job(user_id=user_id)
        if not latest_ocr_job:
            return None
        return await self.trigger_refresh_for_ocr_job(user_id=user_id, ocr_job_id=latest_ocr_job.id, reason=reason)

    async def trigger_refresh_for_ocr_job(self, *, user_id: int, ocr_job_id: int, reason: str) -> GuideJob | None:
        required, source_guide_job_id = await self.is_profile_refresh_required_for_guide_generation(user_id=user_id)
        if required:
            if source_guide_job_id is not None:
                await self._create_weekly_refresh_required_notification(
                    user_id=user_id,
                    source_guide_job_id=source_guide_job_id,
                )
            return None

        ocr_job = await OcrJob.get_or_none(id=ocr_job_id, user_id=user_id)
        if not ocr_job or ocr_job.status != OcrJobStatus.SUCCEEDED:
            return None

        if await self._has_pending_guide_job_for_ocr(user_id=user_id, ocr_job_id=ocr_job_id):
            return None

        job = await GuideJob.create(user_id=user_id, ocr_job_id=ocr_job_id, max_retries=config.GUIDE_JOB_MAX_RETRIES)
        if not await self.enqueue_or_fail(job, reason=reason):
            return None
        return job

    async def enqueue_or_fail(self, job: GuideJob, *, reason: str = "") -> bool:
        """큐 등록 시도. 실패 시 FAILED로 전환하고 False 반환."""
        try:
            await self.queue_publisher.enqueue_job(job.id)
            return True
        except RuntimeError:
            failed_at = datetime.now(config.TIMEZONE)
            await GuideJob.filter(id=job.id, status=GuideJobStatus.QUEUED).update(
                status=GuideJobStatus.FAILED,
                failure_code=GuideFailureCode.PROCESSING_ERROR,
                error_message=f"[PROCESSING_ERROR] guide queue publish failed ({reason}).",
                completed_at=failed_at,
            )
            default_logger.exception("guide queue publish failed (job_id=%s reason=%s)", job.id, reason)
            return False

    async def _log_low_rated_prompt_versions(self) -> None:
        """피드백 평균 평점 < 3.0인 프롬프트 버전을 로그에 경고한다."""
        from tortoise.functions import Avg

        rows = (
            await GuideFeedback.all()
            .group_by("prompt_version")
            .annotate(avg_rating=Avg("rating"))
            .values("prompt_version", "avg_rating")
        )
        for row in rows:
            avg = float(row["avg_rating"] or 0)
            if avg < 3.0:
                default_logger.warning(
                    "low_feedback_score: prompt_version=%s avg_rating=%.2f — improvement recommended",
                    row["prompt_version"],
                    avg,
                )

    async def process_weekly_refresh_due_users(self, *, batch_size: int) -> int:
        lock_key = "guide:weekly_refresh_lock"
        lock_ttl = config.GUIDE_WEEKLY_REFRESH_CHECK_INTERVAL_SECONDS
        try:
            acquired = await _get_redis_client().set(lock_key, "1", nx=True, ex=lock_ttl)
            if not acquired:
                return 0
        except RedisError:
            default_logger.warning("weekly_refresh_lock_redis_error — skipping this cycle", exc_info=True)
            return 0

        try:
            await self._log_low_rated_prompt_versions()
        except Exception:
            default_logger.warning("failed to log low-rated prompt versions", exc_info=True)

        cutoff = datetime.now(config.TIMEZONE) - timedelta(days=7)
        user_ids = (
            await GuideJob.filter(status=GuideJobStatus.SUCCEEDED, completed_at__lte=cutoff)
            .distinct()
            .limit(batch_size)
            .values_list("user_id", flat=True)
        )
        processed = 0
        for user_id in user_ids:
            notified = await self.notify_weekly_refresh_if_due(user_id=user_id)
            if notified:
                processed += 1
        return processed
