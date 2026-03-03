import asyncio
import json
import time
from collections.abc import Awaitable, Callable
from datetime import date, datetime
from logging import Logger
from typing import Any, cast

import httpx
from redis.asyncio import Redis
from redis.exceptions import RedisError
from tortoise.transactions import in_transaction

from ai_worker.core import config
from app.models.health_profiles import UserHealthProfile
from app.models.guides import GuideFailureCode, GuideJob, GuideJobStatus, GuideResult, GuideRiskLevel
from app.models.notifications import Notification, NotificationType
from app.models.ocr import OcrJobStatus, OcrResult

GUIDE_SAFETY_NOTICE = (
    "본 서비스에서 제공되는 약물 및 생활 관리 안내는 참고용 정보이며, 의료진의 진단·치료·처방을 대체하지 않습니다."
)
DEFAULT_LLM_FALLBACK = (
    "최근 프로필과 처방 정보를 기준으로 복약/생활습관 가이드를 업데이트했습니다. "
    "수면과 식사 시간을 일정하게 유지하고, 복약 누락 시 임의 증량 없이 의료진 지침을 우선하세요."
)

ALLOWED_STATUS_TRANSITIONS: dict[GuideJobStatus, set[GuideJobStatus]] = {
    GuideJobStatus.QUEUED: {GuideJobStatus.PROCESSING},
    GuideJobStatus.PROCESSING: {GuideJobStatus.QUEUED, GuideJobStatus.SUCCEEDED, GuideJobStatus.FAILED},
    GuideJobStatus.SUCCEEDED: set(),
    GuideJobStatus.FAILED: set(),
}


def compute_retry_delay_seconds(retry_count: int) -> int:
    attempt = max(retry_count - 1, 0)
    delay = config.GUIDE_RETRY_BACKOFF_BASE_SECONDS * (2**attempt)
    return min(delay, config.GUIDE_RETRY_BACKOFF_MAX_SECONDS)


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

    async def flush_due_retries(self, *, batch_size: int) -> int:
        now = int(time.time())
        moved = 0
        try:
            while moved < batch_size:
                members = await self.client.zrangebyscore(
                    config.GUIDE_RETRY_QUEUE_KEY,
                    min="-inf",
                    max=now,
                    start=0,
                    num=batch_size - moved,
                )
                if not members:
                    break

                for member in members:
                    removed = await self.client.zrem(config.GUIDE_RETRY_QUEUE_KEY, member)
                    if not removed:
                        continue
                    await cast(Awaitable[int], self.client.rpush(config.GUIDE_QUEUE_KEY, member))
                    moved += 1
                    if moved >= batch_size:
                        break
        except RedisError:
            self.logger.warning("redis guide retry queue flush failed")
            return moved

        if moved:
            self.logger.info("moved %s guide retry jobs back to main queue", moved)
        return moved

    async def schedule_retry(self, job_id: int, retry_count: int) -> None:
        delay_seconds = compute_retry_delay_seconds(retry_count)
        retry_at = int(time.time()) + delay_seconds
        try:
            await self.client.zadd(config.GUIDE_RETRY_QUEUE_KEY, {str(job_id): retry_at})
            self.logger.warning(
                "guide job scheduled for retry (job_id=%s retry_count=%s delay=%ss)",
                job_id,
                retry_count,
                delay_seconds,
            )
        except RedisError:
            self.logger.warning("redis guide retry schedule failed (job_id=%s retry_count=%s)", job_id, retry_count)

    async def send_to_dead_letter(self, payload: dict[str, Any]) -> None:
        try:
            await cast(
                Awaitable[int],
                self.client.rpush(config.GUIDE_DEAD_LETTER_QUEUE_KEY, json.dumps(payload, ensure_ascii=False)),
            )
        except RedisError:
            self.logger.warning("redis guide dead letter enqueue failed (payload=%s)", payload)


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


def _parse_date_or_none(raw_value: Any) -> date | None:
    if not isinstance(raw_value, str):
        return None
    try:
        return date.fromisoformat(raw_value)
    except ValueError:
        return None


def _compute_remaining_days(*, dispensed_date: date | None, total_days: int) -> int:
    if not dispensed_date:
        return total_days
    elapsed = (datetime.now(config.TIMEZONE).date() - dispensed_date).days
    return max(total_days - max(elapsed, 0), 0)


def _build_medication_guide(confirmed_ocr: dict[str, Any]) -> list[dict[str, Any]]:
    medications = confirmed_ocr.get("extracted_medications")
    if not isinstance(medications, list):
        return []

    guide_items: list[dict[str, Any]] = []
    for medication in medications:
        if not isinstance(medication, dict):
            continue
        total_days = int(medication.get("total_days", 0) or 0)
        dispensed_date = _parse_date_or_none(medication.get("dispensed_date"))
        days_left = _compute_remaining_days(dispensed_date=dispensed_date, total_days=max(total_days, 0))
        guide_items.append(
            {
                "drug_name": medication.get("drug_name"),
                "dose": medication.get("dose"),
                "dosage_per_once": medication.get("dosage_per_once"),
                "frequency_per_day": medication.get("frequency_per_day"),
                "intake_time": medication.get("intake_time", []),
                "administration_timing": medication.get("administration_timing"),
                "side_effect": medication.get("side_effect"),
                "refill_reminder_days_before": f"약 떨어지기 {days_left}일전",
            }
        )
    return guide_items


def _build_lifestyle_flags(profile: UserHealthProfile) -> dict[str, bool]:
    return {
        "nutrition_guide": profile.bmi < 18.5 or profile.appetite_level <= 3,
        "exercise_guide": profile.bmi >= 25 or profile.exercise_frequency_per_week <= 1,
        "concentration_strategy": profile.digital_time_hours >= 8,
        "sleep_guide": profile.sleep_time_hours < 6 or profile.sleep_latency_minutes >= 30,
        "caffeine_guide": profile.caffeine_mg >= 300,
        "smoking_guide": profile.smoking > 0,
        "drinking_guide": profile.alcohol_frequency_per_week >= 3,
    }


def _derive_risk_level(profile: UserHealthProfile) -> GuideRiskLevel:
    risk_score = 0
    if profile.sleep_time_hours < 6:
        risk_score += 1
    if profile.digital_time_hours >= 8:
        risk_score += 1
    if profile.caffeine_mg >= 300:
        risk_score += 1
    if profile.smoking > 0:
        risk_score += 1
    if profile.alcohol_frequency_per_week >= 3:
        risk_score += 1
    if risk_score >= 4:
        return GuideRiskLevel.HIGH
    if risk_score >= 2:
        return GuideRiskLevel.MEDIUM
    return GuideRiskLevel.LOW


async def _generate_lifestyle_guide_with_llm(
    *,
    profile: UserHealthProfile,
    confirmed_ocr: dict[str, Any],
    flags: dict[str, bool],
) -> dict[str, str]:
    fallback = {
        "nutrition_guide": "식욕 저하나 저체중 경향이 있으면 단백질과 수분 섭취를 우선 보강하세요.",
        "exercise_guide": "주 3회 이상 20~30분 유산소 운동을 권장합니다.",
        "concentration_strategy": "연속 스크린타임은 50분 이내로 제한하고 10분 휴식을 추가하세요.",
        "sleep_guide": "취침/기상 시간을 고정하고 카페인은 취침 8시간 전부터 제한하세요.",
        "caffeine_guide": "하루 카페인 총량을 200mg 이하로 줄여보세요.",
        "smoking_guide": "흡연량을 단계적으로 줄이고 금연 클리닉 상담을 권장합니다.",
        "drinking_guide": "음주 빈도를 주 1회 이하로 제한하세요.",
        "general_health_guide": DEFAULT_LLM_FALLBACK,
    }
    if not config.OPENAI_API_KEY:
        return fallback

    prompt_context = {
        "profile": {
            "bmi": profile.bmi,
            "sleep_time_hours": profile.sleep_time_hours,
            "caffeine_mg": profile.caffeine_mg,
            "digital_time_hours": profile.digital_time_hours,
            "exercise_frequency_per_week": profile.exercise_frequency_per_week,
            "smoking": profile.smoking,
            "alcohol_frequency_per_week": profile.alcohol_frequency_per_week,
            "appetite_level": profile.appetite_level,
        },
        "flags": flags,
        "confirmed_ocr": confirmed_ocr,
    }
    system_prompt = (
        "너는 ADHD 환자 생활습관 코치다. 출력은 JSON object로만 반환한다. "
        "키는 nutrition_guide, exercise_guide, concentration_strategy, sleep_guide, "
        "caffeine_guide, smoking_guide, drinking_guide, general_health_guide 이다."
    )
    user_prompt = (
        "다음 환자 데이터를 바탕으로 간결하고 실행 가능한 한국어 가이드를 작성해라. "
        f"조건 데이터: {json.dumps(prompt_context, ensure_ascii=False)}"
    )
    try:
        async with httpx.AsyncClient(timeout=config.GUIDE_LLM_TIMEOUT_SECONDS) as client:
            response = await client.post(
                f"{config.OPENAI_BASE_URL.rstrip('/')}/chat/completions",
                headers={"Authorization": f"Bearer {config.OPENAI_API_KEY}"},
                json={
                    "model": config.OPENAI_MODEL,
                    "response_format": {"type": "json_object"},
                    "messages": [
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_prompt},
                    ],
                    "temperature": 0.2,
                },
            )
            response.raise_for_status()
            data = response.json()
            content = data["choices"][0]["message"]["content"]
            parsed = json.loads(content)
            if isinstance(parsed, dict):
                for key, value in fallback.items():
                    parsed.setdefault(key, value)
                return {key: str(value) for key, value in parsed.items()}
    except Exception:
        return fallback
    return fallback


async def _handle_guide_job_failure(
    *,
    job_id: int,
    err: Exception,
    logger: Logger,
    schedule_retry: Callable[[int, int], Awaitable[None]] | None = None,
    send_to_dead_letter: Callable[[dict[str, Any]], Awaitable[None]] | None = None,
) -> bool:
    current = await GuideJob.get_or_none(id=job_id)
    if not current:
        logger.warning("guide job missing during failure handling (job_id=%s)", job_id)
        return False

    next_retry_count = current.retry_count + 1
    failure_code = _classify_failure(err)
    error_message = _format_error_message(failure_code=failure_code, detail=str(err))

    if next_retry_count < current.max_retries:
        _ensure_transition(GuideJobStatus.PROCESSING, GuideJobStatus.QUEUED)
        await GuideJob.filter(id=current.id, status=GuideJobStatus.PROCESSING).update(
            status=GuideJobStatus.QUEUED,
            retry_count=next_retry_count,
            error_message=error_message,
            failure_code=failure_code,
            completed_at=None,
        )
        if schedule_retry:
            await schedule_retry(current.id, next_retry_count)
        logger.warning("guide job retry scheduled (job_id=%s retry_count=%s)", current.id, next_retry_count)
        return True

    _ensure_transition(GuideJobStatus.PROCESSING, GuideJobStatus.FAILED)
    failed_at = datetime.now(config.TIMEZONE)
    await GuideJob.filter(id=current.id, status=GuideJobStatus.PROCESSING).update(
        status=GuideJobStatus.FAILED,
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
                "ocr_job_id": current.ocr_job_id,
                "failure_code": failure_code.value,
                "error_message": error_message,
                "retry_count": next_retry_count,
                "max_retries": current.max_retries,
                "failed_at": failed_at.isoformat(),
            }
        )
    logger.exception("guide job processing failed (job_id=%s)", job_id)
    return True


async def process_guide_job(
    job_id: int,
    logger: Logger,
    schedule_retry: Callable[[int, int], Awaitable[None]] | None = None,
    send_to_dead_letter: Callable[[dict[str, Any]], Awaitable[None]] | None = None,
) -> bool:
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

        profile = await UserHealthProfile.get_or_none(user_id=job.user_id)
        if not profile:
            raise ValueError(f"User health profile not found: {job.user_id}")

        confirmed_ocr = {}
        if isinstance(ocr_result.structured_data, dict):
            confirmed_ocr = cast(dict[str, Any], ocr_result.structured_data.get("confirmed_ocr", {}))

        medication_guide = _build_medication_guide(confirmed_ocr)
        flags = _build_lifestyle_flags(profile)
        lifestyle_guidance_map = await _generate_lifestyle_guide_with_llm(
            profile=profile, confirmed_ocr=confirmed_ocr, flags=flags
        )
        risk_level = _derive_risk_level(profile)
        active_sections = [name for name, enabled in flags.items() if enabled]
        if not active_sections:
            active_sections = ["general_health_guide"]
        medication_guidance = json.dumps(medication_guide, ensure_ascii=False)
        lifestyle_guidance = "\n".join(
            f"{section}: {lifestyle_guidance_map.get(section, DEFAULT_LLM_FALLBACK)}" for section in active_sections
        )
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
                        "source_attributions": [
                            "사용자 건강 프로필 입력 데이터",
                            "사용자 확인 OCR 처방 데이터",
                            "RAG 지식 소스(연동 예정)",
                        ],
                        "weekly_adherence_rate": profile.weekly_adherence_rate,
                        "active_lifestyle_sections": active_sections,
                        "personalized_guides": {
                            "medication_guide": medication_guide,
                            "lifestyle_guidance": lifestyle_guidance_map,
                        },
                        "llm": {
                            "model": config.OPENAI_MODEL,
                            "enabled": bool(config.OPENAI_API_KEY),
                        },
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
        return await _handle_guide_job_failure(
            job_id=job_id,
            err=err,
            logger=logger,
            schedule_retry=schedule_retry,
            send_to_dead_letter=send_to_dead_letter,
        )

    return True
