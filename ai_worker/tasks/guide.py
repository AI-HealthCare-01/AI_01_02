import asyncio
from collections.abc import Awaitable
from datetime import datetime
from logging import Logger
from typing import Any, cast

from redis.asyncio import Redis
from redis.exceptions import RedisError
from tortoise.transactions import in_transaction

from ai_worker.core import config
from app.models.guides import GuideFailureCode, GuideJob, GuideJobStatus, GuideResult, GuideRiskLevel
from app.models.notifications import Notification, NotificationType
from app.models.ocr import OcrJobStatus, OcrResult

GUIDE_SAFETY_NOTICE = "본 가이드는 의료진 진료를 대체할 수 없습니다."

ALLOWED_STATUS_TRANSITIONS: dict[GuideJobStatus, set[GuideJobStatus]] = {
    GuideJobStatus.QUEUED: {GuideJobStatus.PROCESSING},
    GuideJobStatus.PROCESSING: {GuideJobStatus.SUCCEEDED, GuideJobStatus.FAILED},
    GuideJobStatus.SUCCEEDED: set(),
    GuideJobStatus.FAILED: set(),
}


class GuideQueueConsumer:
    def __init__(self, logger: Logger) -> None:
        self.logger = logger
        self.client = Redis(
            host=config.REDIS_HOST,
            port=config.REDIS_PORT,
            db=config.REDIS_DB,
            password=config.REDIS_PASSWORD,
            decode_responses=True,
            socket_connect_timeout=config.REDIS_SOCKET_TIMEOUT_SECONDS,
            socket_timeout=config.REDIS_SOCKET_TIMEOUT_SECONDS,
        )

    async def close(self) -> None:
        await self.client.aclose()

    async def pop_job_id(self) -> int | None:
        try:
            popped = await cast(
                Awaitable[list[Any] | None],
                self.client.blpop([config.GUIDE_QUEUE_KEY], timeout=config.GUIDE_QUEUE_BLOCK_TIMEOUT_SECONDS),
            )
        except RedisError:
            self.logger.warning("redis guide queue consume failed")
            await asyncio.sleep(1)
            return None

        if popped is None:
            return None

        _, raw_job_id = popped
        try:
            return int(raw_job_id)
        except ValueError:
            self.logger.warning("invalid guide queue payload received: %s", raw_job_id)
            return None


def _ensure_transition(from_status: GuideJobStatus, to_status: GuideJobStatus) -> None:
    if to_status not in ALLOWED_STATUS_TRANSITIONS[from_status]:
        raise ValueError(f"Invalid Guide state transition: {from_status} -> {to_status}")


def _classify_failure(err: Exception) -> GuideFailureCode:
    detail = str(err)
    if isinstance(err, ValueError) and "OCR job not ready" in detail:
        return GuideFailureCode.OCR_NOT_READY
    if isinstance(err, ValueError) and "OCR result not found" in detail:
        return GuideFailureCode.OCR_RESULT_NOT_FOUND
    if isinstance(err, ValueError) and "Invalid Guide state transition" in detail:
        return GuideFailureCode.INVALID_STATE_TRANSITION
    return GuideFailureCode.PROCESSING_ERROR


def _format_error_message(*, failure_code: GuideFailureCode, detail: str) -> str:
    return f"[{failure_code.value}] {detail}"[:1000]


def _build_placeholder_guidance(extracted_text: str) -> tuple[str, str, GuideRiskLevel]:
    source_preview = extracted_text[:120]
    medication_guidance = (
        "복약 시간과 용량을 처방 기준으로 고정하고, 누락 시 임의 증량 없이 다음 복용 시점부터 재개하세요. "
        f"(근거 텍스트 일부: {source_preview})"
    )
    lifestyle_guidance = (
        "수분 섭취, 수면, 식사 시간을 일정하게 유지하고 이상 증상이 있으면 기록 후 의료진과 상담하세요. "
        "새로운 보충제나 약물은 병용 전 확인이 필요합니다."
    )
    return medication_guidance, lifestyle_guidance, GuideRiskLevel.MEDIUM


async def process_guide_job(job_id: int, logger: Logger) -> bool:
    now = datetime.now(config.TIMEZONE)
    _ensure_transition(GuideJobStatus.QUEUED, GuideJobStatus.PROCESSING)
    claimed = await GuideJob.filter(id=job_id, status=GuideJobStatus.QUEUED).update(
        status=GuideJobStatus.PROCESSING,
        started_at=now,
        completed_at=None,
        error_message=None,
        failure_code=None,
    )
    if claimed == 0:
        existing = await GuideJob.get_or_none(id=job_id)
        if not existing:
            logger.warning("guide job not found (job_id=%s)", job_id)
            return False
        logger.info("skip non-queued guide job (job_id=%s, status=%s)", job_id, existing.status)
        return True

    job = await GuideJob.filter(id=job_id).select_related("ocr_job").first()
    if not job:
        logger.warning("guide job not found after claim (job_id=%s)", job_id)
        return False

    try:
        if job.ocr_job.status != OcrJobStatus.SUCCEEDED:
            raise ValueError(f"OCR job not ready: {job.ocr_job_id}")

        ocr_result = await OcrResult.get_or_none(job_id=job.ocr_job_id)
        if not ocr_result:
            raise ValueError(f"OCR result not found: {job.ocr_job_id}")

        medication_guidance, lifestyle_guidance, risk_level = _build_placeholder_guidance(ocr_result.extracted_text)
        completed_at = datetime.now(config.TIMEZONE)

        async with in_transaction():
            await GuideResult.update_or_create(
                job_id=job.id,
                defaults={
                    "medication_guidance": medication_guidance,
                    "lifestyle_guidance": lifestyle_guidance,
                    "risk_level": risk_level,
                    "safety_notice": GUIDE_SAFETY_NOTICE,
                    "structured_data": {
                        "source_ocr_job_id": job.ocr_job_id,
                        "source_ocr_result_id": ocr_result.id,
                        "generator": "guide-placeholder-v1",
                    },
                    "updated_at": completed_at,
                },
            )
            await Notification.create(
                user_id=job.user_id,
                type=NotificationType.GUIDE_READY,
                title="가이드 생성 완료",
                message="요청하신 건강 가이드가 생성되었습니다.",
                payload={
                    "event": "guide_ready",
                    "guide_job_id": job.id,
                    "ocr_job_id": job.ocr_job_id,
                    "risk_level": risk_level.value,
                },
            )
            _ensure_transition(GuideJobStatus.PROCESSING, GuideJobStatus.SUCCEEDED)
            await GuideJob.filter(id=job.id, status=GuideJobStatus.PROCESSING).update(
                status=GuideJobStatus.SUCCEEDED,
                completed_at=completed_at,
                error_message=None,
                failure_code=None,
            )
        logger.info("guide job processed successfully (job_id=%s)", job_id)
    except Exception as err:
        failure_code = _classify_failure(err)
        error_message = _format_error_message(failure_code=failure_code, detail=str(err))
        _ensure_transition(GuideJobStatus.PROCESSING, GuideJobStatus.FAILED)
        failed_at = datetime.now(config.TIMEZONE)
        await GuideJob.filter(id=job.id, status=GuideJobStatus.PROCESSING).update(
            status=GuideJobStatus.FAILED,
            retry_count=job.retry_count + 1,
            completed_at=failed_at,
            error_message=error_message,
            failure_code=failure_code,
        )
        logger.exception("guide job processing failed (job_id=%s)", job_id)

    return True
