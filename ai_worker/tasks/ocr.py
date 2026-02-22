import asyncio
import json
import time
from collections.abc import Awaitable, Callable
from datetime import datetime
from logging import Logger
from pathlib import Path
from typing import Any

from redis.asyncio import Redis
from redis.exceptions import RedisError
from tortoise.transactions import in_transaction

from ai_worker.core import config
from app.models.ocr import OcrFailureCode, OcrJob, OcrJobStatus, OcrResult

ALLOWED_STATUS_TRANSITIONS: dict[OcrJobStatus, set[OcrJobStatus]] = {
    OcrJobStatus.QUEUED: {OcrJobStatus.PROCESSING},
    OcrJobStatus.PROCESSING: {OcrJobStatus.QUEUED, OcrJobStatus.SUCCEEDED, OcrJobStatus.FAILED},
    OcrJobStatus.SUCCEEDED: set(),
    OcrJobStatus.FAILED: {OcrJobStatus.QUEUED},
}


def compute_retry_delay_seconds(retry_count: int) -> int:
    attempt = max(retry_count - 1, 0)
    delay = config.OCR_RETRY_BACKOFF_BASE_SECONDS * (2**attempt)
    return min(delay, config.OCR_RETRY_BACKOFF_MAX_SECONDS)


class OcrQueueConsumer:
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
            popped = await self.client.blpop(config.OCR_QUEUE_KEY, timeout=config.OCR_QUEUE_BLOCK_TIMEOUT_SECONDS)
        except RedisError:
            self.logger.warning("redis queue consume failed")
            await asyncio.sleep(1)
            return None

        if popped is None:
            return None

        _, raw_job_id = popped
        try:
            return int(raw_job_id)
        except ValueError:
            self.logger.warning("invalid queue payload received: %s", raw_job_id)
            return None

    async def flush_due_retries(self, *, batch_size: int) -> int:
        now = int(time.time())
        moved = 0
        try:
            while moved < batch_size:
                members = await self.client.zrangebyscore(
                    config.OCR_RETRY_QUEUE_KEY,
                    min="-inf",
                    max=now,
                    start=0,
                    num=batch_size - moved,
                )
                if not members:
                    break

                for member in members:
                    removed = await self.client.zrem(config.OCR_RETRY_QUEUE_KEY, member)
                    if not removed:
                        continue
                    await self.client.rpush(config.OCR_QUEUE_KEY, member)
                    moved += 1
                    if moved >= batch_size:
                        break
        except RedisError:
            self.logger.warning("redis retry queue flush failed")
            return moved

        if moved:
            self.logger.info("moved %s retry jobs back to main queue", moved)
        return moved

    async def schedule_retry(self, job_id: int, retry_count: int) -> None:
        delay_seconds = compute_retry_delay_seconds(retry_count)
        retry_at = int(time.time()) + delay_seconds
        try:
            await self.client.zadd(config.OCR_RETRY_QUEUE_KEY, {str(job_id): retry_at})
            self.logger.warning(
                "ocr job scheduled for retry (job_id=%s retry_count=%s delay=%ss)",
                job_id,
                retry_count,
                delay_seconds,
            )
        except RedisError:
            self.logger.warning("redis retry schedule failed (job_id=%s retry_count=%s)", job_id, retry_count)

    async def send_to_dead_letter(self, payload: dict[str, Any]) -> None:
        try:
            await self.client.rpush(config.OCR_DEAD_LETTER_QUEUE_KEY, json.dumps(payload, ensure_ascii=False))
        except RedisError:
            self.logger.warning("redis dead letter enqueue failed (payload=%s)", payload)


def _ensure_transition(from_status: OcrJobStatus, to_status: OcrJobStatus) -> None:
    if to_status not in ALLOWED_STATUS_TRANSITIONS[from_status]:
        raise ValueError(f"Invalid OCR state transition: {from_status} -> {to_status}")


def _classify_failure(err: Exception) -> OcrFailureCode:
    if isinstance(err, FileNotFoundError):
        return OcrFailureCode.FILE_NOT_FOUND
    if isinstance(err, ValueError) and "Invalid OCR state transition" in str(err):
        return OcrFailureCode.INVALID_STATE_TRANSITION
    return OcrFailureCode.PROCESSING_ERROR


def _format_error_message(*, failure_code: OcrFailureCode, detail: str) -> str:
    return f"[{failure_code.value}] {detail}"[:1000]


async def process_ocr_job(
    job_id: int,
    logger: Logger,
    schedule_retry: Callable[[int, int], Awaitable[None]] | None = None,
    send_to_dead_letter: Callable[[dict[str, Any]], Awaitable[None]] | None = None,
) -> bool:
    now = datetime.now(config.TIMEZONE)
    _ensure_transition(OcrJobStatus.QUEUED, OcrJobStatus.PROCESSING)
    claimed = await OcrJob.filter(id=job_id, status=OcrJobStatus.QUEUED).update(
        status=OcrJobStatus.PROCESSING,
        started_at=now,
        completed_at=None,
        error_message=None,
        failure_code=None,
    )
    if claimed == 0:
        existing = await OcrJob.get_or_none(id=job_id)
        if not existing:
            logger.warning("ocr job not found (job_id=%s)", job_id)
            return False
        logger.info("skip non-queued ocr job (job_id=%s, status=%s)", job_id, existing.status)
        return True

    job = await OcrJob.filter(id=job_id).select_related("document").first()
    if not job:
        logger.warning("ocr job not found after claim (job_id=%s)", job_id)
        return False

    try:
        absolute_file_path = Path(config.MEDIA_DIR).resolve() / job.document.file_path
        if not absolute_file_path.exists():
            raise FileNotFoundError(f"document file not found: {absolute_file_path}")

        raw_content = absolute_file_path.read_bytes()
        extracted_text = f"OCR placeholder output for {job.document.file_name} ({len(raw_content)} bytes)"
        structured_data = {
            "document_type": job.document.document_type,
            "file_name": job.document.file_name,
            "file_size": len(raw_content),
            "processor": "ocr-placeholder-v1",
        }
        completed_at = datetime.now(config.TIMEZONE)

        async with in_transaction():
            await OcrResult.update_or_create(
                job_id=job.id,
                defaults={
                    "extracted_text": extracted_text,
                    "structured_data": structured_data,
                    "updated_at": completed_at,
                },
            )
            _ensure_transition(OcrJobStatus.PROCESSING, OcrJobStatus.SUCCEEDED)
            await OcrJob.filter(id=job.id, status=OcrJobStatus.PROCESSING).update(
                status=OcrJobStatus.SUCCEEDED,
                completed_at=completed_at,
                error_message=None,
                failure_code=None,
            )
        logger.info("ocr job processed successfully (job_id=%s)", job_id)
    except Exception as err:
        current = await OcrJob.get_or_none(id=job_id)
        if not current:
            logger.warning("ocr job missing during failure handling (job_id=%s)", job_id)
            return False

        next_retry_count = current.retry_count + 1
        failure_code = _classify_failure(err)
        error_message = _format_error_message(failure_code=failure_code, detail=str(err))

        if next_retry_count < current.max_retries:
            _ensure_transition(OcrJobStatus.PROCESSING, OcrJobStatus.QUEUED)
            await OcrJob.filter(id=current.id, status=OcrJobStatus.PROCESSING).update(
                status=OcrJobStatus.QUEUED,
                retry_count=next_retry_count,
                error_message=error_message,
                failure_code=failure_code,
                completed_at=None,
            )
            if schedule_retry:
                await schedule_retry(current.id, next_retry_count)
            logger.warning("ocr job retry scheduled (job_id=%s retry_count=%s)", current.id, next_retry_count)
            return True

        _ensure_transition(OcrJobStatus.PROCESSING, OcrJobStatus.FAILED)
        failed_at = datetime.now(config.TIMEZONE)
        await OcrJob.filter(id=current.id, status=OcrJobStatus.PROCESSING).update(
            status=OcrJobStatus.FAILED,
            retry_count=next_retry_count,
            completed_at=failed_at,
            error_message=error_message,
            failure_code=failure_code,
        )
        if send_to_dead_letter:
            await send_to_dead_letter(
                {
                    "job_id": current.id,
                    "user_id": current.user_id,
                    "document_id": current.document_id,
                    "failure_code": failure_code.value,
                    "error_message": error_message,
                    "retry_count": next_retry_count,
                    "max_retries": current.max_retries,
                    "failed_at": failed_at.isoformat(),
                }
            )
        logger.exception("ocr job processing failed (job_id=%s)", job_id)

    return True
