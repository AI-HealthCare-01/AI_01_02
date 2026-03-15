import json
import logging
from collections.abc import Awaitable, Callable
from datetime import date, datetime
from logging import Logger
from typing import Any, cast

from openai import AsyncOpenAI
from tortoise.transactions import in_transaction

from ai_worker.core import config
from ai_worker.tasks.queue import QueueConsumer
from app.models.guides import GuideFailureCode, GuideJob, GuideJobStatus, GuideResult, GuideRiskLevel
from app.models.health_profiles import UserHealthProfile
from app.models.notifications import Notification, NotificationType
from app.models.ocr import OcrJobStatus
from app.services.medications import MedicationInfoService

# REQ-049: 프롬프트 버전 관리
GUIDE_PROMPT_VERSION = "v1.2"

_GUIDE_SYSTEM_PROMPT = """
You are a clinical medication and lifestyle guidance assistant specializing in ADHD care.

Return only a JSON object with exactly these keys:
nutrition_guide, exercise_guide, concentration_strategy, sleep_guide,
caffeine_guide, smoking_guide, drinking_guide, general_health_guide.

All guidance must be in Korean and follow these global constraints:
- Do NOT make a definitive medical diagnosis.
- Use professional, calm, non-alarming, supportive language.
- Provide practical and actionable advice.
- Do not use bullet points.
- Do not mention raw numeric input values.
- Encourage gradual and sustainable behavior change when relevant.
- Output only the guidance text values in JSON (no markdown, no extra commentary).

Section-specific rules:

nutrition_guide:
- risk_code=UNDERWEIGHT_HIGH_RISK: cautious wording("의심됩니다","가능성이 있습니다"), mention risks(면역력 저하, 근육 감소, 피로, 집중력 저하), recommend medical evaluation, 4-6 sentences.
- risk_code=UNDERWEIGHT_BORDERLINE: not severe framing, emphasize monitoring/prevention, check diet/weight trend, recommend consultation only if persistent, 4-5 sentences.
- risk_code=IRREGULAR_MEAL_PATTERN: explain impact on concentration/energy, suggest practical routines(alarm/fixed meal times), emphasize gradual improvement, 3-4 sentences.
- If UNDERWEIGHT_BORDERLINE and IRREGULAR_MEAL_PATTERN both apply, include both guidance intents in one natural paragraph.

sleep_guide:
- sleep_risk_code=SLEEP_HIGH_RISK: condition is sleep_time<=4 OR (sleep_time<=6 and awakenings>=4) OR daytime_sleepiness>=8. Explain insufficient sleep/frequent awakenings can reduce attention/judgment, advise avoiding driving/high-risk activities, strongly recommend rest, recommend medical consultation, 2-4 sentences.
- sleep_risk_code=SHORT_SLEEP: condition is 4<sleep_time<=6 OR frequent awakenings OR early awakening. Explain sleep is currently insufficient, suggest avoiding afternoon caffeine and pre-bed alcohol, minimize naps, maintain consistent sleep-wake schedule, mention consultation only if severe snoring/apnea is suspected, 3-5 sentences.
- sleep_risk_code=INSOMNIA_ONSET: suggest reducing screen exposure before bed, fixed wake time, leave bed briefly when unable to sleep, daytime sunlight exposure, limit caffeine, 4-6 sentences.

exercise_guide:
- lifestyle_risk_code=OVERWEIGHT_RISK: mention weight management may be needed, review diet and balanced intake, recommend manageable regular physical activity, emphasize gradual/sustainable change, 3-5 sentences.
- lifestyle_risk_code=LOW_ACTIVITY: state activity appears insufficient, suggest light activities(walking/stretching), gradually increase duration, emphasize consistency over intensity, 2-4 sentences.

concentration_strategy:
- digital_risk_code=SCREEN_OVERUSE: explain prolonged screen use may worsen ADHD concentration/sleep, state current screen use appears high, suggest gradual reduction, practical strategies(regular breaks/avoid screens before bed), emphasize small consistent change, 4-6 sentences.

caffeine_guide:
- caffeine_risk_code=CAFFEINE_HIGH_RISK: explain high caffeine may amplify ADHD stimulant effects, mention symptoms(긴장/집중 저하/떨림/수면 방해), recommend limiting intake, monitor sensitivity symptoms, consult professional if worsening, 2-4 sentences.

smoking_guide:
- smoking_risk_code=SMOKING_ACTIVE: explain smoking may affect ADHD medication effects/side effects, mention possible changes(심박수/혈압/불안), encourage reduction/avoidance, monitor symptoms during medication, consult if worsening, 2-4 sentences.

drinking_guide:
- alcohol_risk_code=ALCOHOL_REGULAR: explain alcohol with ADHD medication may worsen sleep/concentration/anxiety, encourage moderation/avoidance while on medication, monitor sleep/mood/attention changes, consult if worsening, 3-5 sentences.
- alcohol_risk_code=ALCOHOL_HIGH_RISK: explain current alcohol level may pose serious health risks, emphasize reduction/control, suggest professional help if self-control is difficult, advise prompt medical visit for severe dizziness/reduced consciousness/extreme anxiety/depressive symptoms, 3-5 sentences.

If a section risk code is NONE, provide short preventive guidance in 1-2 natural Korean sentences.
If all section risk codes are NONE, write general_health_guide as a supportive Korean paragraph for a user who is
already maintaining healthy ADHD-related routines:
- Start by acknowledging and praising current efforts.
- Emphasize that consistent habits support concentration and daily stability.
- Encourage maintaining current behaviors.
- Suggest small practical habits (consistent sleep timing, regular breaks, daily routine check).
- Tone: calm, supportive, professional, not overly diagnostic/medical.
- No bullet points, no numeric values, natural paragraph form, 4-6 sentences.
""".strip()

GUIDE_SAFETY_NOTICE = (
    "본 서비스에서 제공되는 약물 및 생활 관리 안내는 참고용 정보이며, 의료진의 진단·치료·처방을 대체하지 않습니다."
)
DEFAULT_LLM_FALLBACK = (
    "최근 프로필과 처방 정보를 기준으로 복약/생활습관 가이드를 업데이트했습니다. "
    "수면과 식사 시간을 일정하게 유지하고, 복약 누락 시 임의 증량 없이 의료진 지침을 우선하세요."
)

DEFAULT_HEALTHY_GENERAL_GUIDE = (
    "현재 생활습관을 꾸준히 관리하고 계신 점이 매우 좋습니다. 지금처럼 규칙적인 일상을 유지하는 습관은 "
    "집중력과 하루 리듬의 안정에 도움이 됩니다. 현재 실천 중인 건강한 패턴을 계속 이어가 보세요. "
    "여기에 더해 취침과 기상 시간을 가능한 일정하게 맞추고, 활동 중간에 짧은 휴식을 넣으며 하루 계획을 "
    "간단히 점검하면 안정적인 루틴 유지에 도움이 됩니다."
)

ALLOWED_STATUS_TRANSITIONS: dict[GuideJobStatus, set[GuideJobStatus]] = {
    GuideJobStatus.QUEUED: {GuideJobStatus.PROCESSING},
    GuideJobStatus.PROCESSING: {GuideJobStatus.QUEUED, GuideJobStatus.SUCCEEDED, GuideJobStatus.FAILED},
    GuideJobStatus.SUCCEEDED: set(),
    GuideJobStatus.FAILED: set(),
}


class GuideQueueConsumer(QueueConsumer):
    def __init__(self, logger: Logger) -> None:
        super().__init__(
            logger,
            queue_key=config.GUIDE_QUEUE_KEY,
            retry_queue_key=config.GUIDE_RETRY_QUEUE_KEY,
            dead_letter_queue_key=config.GUIDE_DEAD_LETTER_QUEUE_KEY,
            block_timeout_seconds=config.GUIDE_QUEUE_BLOCK_TIMEOUT_SECONDS,
            retry_backoff_base_seconds=config.GUIDE_RETRY_BACKOFF_BASE_SECONDS,
            retry_backoff_max_seconds=config.GUIDE_RETRY_BACKOFF_MAX_SECONDS,
        )


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


async def _build_medication_guide(confirmed_ocr: dict[str, Any]) -> list[dict[str, Any]]:
    medications = confirmed_ocr.get("extracted_medications")
    if not isinstance(medications, list):
        return []

    guide_items: list[dict[str, Any]] = []
    info_cache: dict[str, dict[str, str | None] | None] = {}
    info_service = MedicationInfoService()
    for medication in medications:
        if not isinstance(medication, dict):
            continue
        total_days = int(medication.get("total_days", 0) or 0)
        dispensed_date = _parse_date_or_none(medication.get("dispensed_date"))
        days_left = _compute_remaining_days(dispensed_date=dispensed_date, total_days=max(total_days, 0))
        drug_name = medication.get("drug_name")
        precautions_summary: str | None = None
        side_effects_summary: str | None = None
        if isinstance(drug_name, str) and drug_name.strip():
            cache_key = f"{drug_name.lower()}|{medication.get('dose')}"
            if cache_key not in info_cache:
                dose_val = medication.get("dose")
                dose_mg = float(dose_val) if isinstance(dose_val, int | float) else None
                info_cache[cache_key] = await info_service.get_info(name=drug_name, dose_mg=dose_mg)
            info = info_cache.get(cache_key)
            if info:
                precautions_summary = info.get("precautions")
                side_effects_summary = info.get("side_effects")
        guide_items.append(
            {
                "drug_name": drug_name,
                "dose": medication.get("dose"),
                "dosage_per_once": medication.get("dosage_per_once"),
                "frequency_per_day": medication.get("frequency_per_day"),
                "intake_time": medication.get("intake_time", []),
                "administration_timing": medication.get("administration_timing"),
                "side_effect": medication.get("side_effect"),
                "precautions": precautions_summary,
                "side_effects": side_effects_summary,
                "safety_source": info.get("source") if info else None,
                "refill_reminder_days_before": f"약 떨어지기 {days_left}일전",
            }
        )
    return guide_items


def _build_lifestyle_flags(profile: UserHealthProfile) -> dict[str, bool]:
    nutrition_risks = _derive_nutrition_risk_codes(profile)
    sleep_risk = _derive_sleep_risk_code(profile)
    exercise_risk = _derive_exercise_risk_code(profile)
    digital_risk = _derive_digital_risk_code(profile)
    caffeine_risk = _derive_caffeine_risk_code(profile)
    smoking_risk = _derive_smoking_risk_code(profile)
    alcohol_risk = _derive_alcohol_risk_code(profile)
    return {
        "nutrition_guide": len(nutrition_risks) > 0,
        "exercise_guide": exercise_risk != "NONE",
        "concentration_strategy": digital_risk != "NONE",
        "sleep_guide": sleep_risk != "NONE",
        "caffeine_guide": caffeine_risk != "NONE",
        "smoking_guide": smoking_risk != "NONE",
        "drinking_guide": alcohol_risk != "NONE",
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


def _derive_nutrition_risk_codes(profile: UserHealthProfile) -> list[str]:
    is_high_risk = (profile.appetite_level <= 2 and (not profile.meal_regular)) or profile.bmi <= 17
    if is_high_risk:
        return ["UNDERWEIGHT_HIGH_RISK"]

    risks: list[str] = []
    if 17 < profile.bmi <= 18:
        risks.append("UNDERWEIGHT_BORDERLINE")
    if not profile.meal_regular:
        risks.append("IRREGULAR_MEAL_PATTERN")
    return risks


def _derive_sleep_risk_code(profile: UserHealthProfile) -> str:
    is_high_risk = (
        profile.sleep_time_hours <= 4
        or (profile.sleep_time_hours <= 6 and profile.night_awakenings_per_week >= 4)
        or profile.daytime_sleepiness >= 8
    )
    if is_high_risk:
        return "SLEEP_HIGH_RISK"
    if profile.sleep_latency_minutes >= 30:
        return "INSOMNIA_ONSET"
    if (4 < profile.sleep_time_hours <= 6) or (profile.night_awakenings_per_week > 5 and profile.sleep_time_hours >= 7):
        return "SHORT_SLEEP"
    return "NONE"


def _derive_exercise_risk_code(profile: UserHealthProfile) -> str:
    if profile.bmi >= 25:
        return "OVERWEIGHT_RISK"
    if profile.exercise_frequency_per_week <= 1:
        return "LOW_ACTIVITY"
    return "NONE"


def _derive_digital_risk_code(profile: UserHealthProfile) -> str:
    if profile.digital_time_hours >= 8:
        return "SCREEN_OVERUSE"
    return "NONE"


def _derive_caffeine_risk_code(profile: UserHealthProfile) -> str:
    if profile.caffeine_mg >= 200:
        return "CAFFEINE_HIGH_RISK"
    return "NONE"


def _derive_smoking_risk_code(profile: UserHealthProfile) -> str:
    if profile.smoking > 0:
        return "SMOKING_ACTIVE"
    return "NONE"


def _derive_alcohol_risk_code(profile: UserHealthProfile) -> str:
    if profile.alcohol_frequency_per_week >= 3:
        return "ALCOHOL_HIGH_RISK"
    if profile.alcohol_frequency_per_week >= 1:
        return "ALCOHOL_REGULAR"
    return "NONE"


def _build_risk_code_payload(profile: UserHealthProfile) -> dict[str, str]:
    nutrition_risk_codes = _derive_nutrition_risk_codes(profile)
    return {
        "nutrition_risk_code": nutrition_risk_codes[0] if nutrition_risk_codes else "NONE",
        "nutrition_risk_codes": ",".join(nutrition_risk_codes),
        "sleep_risk_code": _derive_sleep_risk_code(profile),
        "lifestyle_risk_code": _derive_exercise_risk_code(profile),
        "digital_risk_code": _derive_digital_risk_code(profile),
        "caffeine_risk_code": _derive_caffeine_risk_code(profile),
        "smoking_risk_code": _derive_smoking_risk_code(profile),
        "alcohol_risk_code": _derive_alcohol_risk_code(profile),
    }


def _build_guide_fallback(*, risk_codes: dict[str, str]) -> dict[str, str]:
    nutrition_code = risk_codes["nutrition_risk_code"]
    nutrition_codes = {code for code in risk_codes.get("nutrition_risk_codes", "").split(",") if code}
    sleep_code = risk_codes["sleep_risk_code"]
    exercise_code = risk_codes["lifestyle_risk_code"]
    digital_code = risk_codes["digital_risk_code"]
    caffeine_code = risk_codes["caffeine_risk_code"]
    smoking_code = risk_codes["smoking_risk_code"]
    alcohol_code = risk_codes["alcohol_risk_code"]

    nutrition_guide = "식사와 수분 섭취를 규칙적으로 유지하면서 체중과 컨디션 변화를 주기적으로 확인해 주세요."
    if nutrition_code == "UNDERWEIGHT_HIGH_RISK":
        nutrition_guide = (
            "현재 영양 상태는 저체중 위험이 의심되며 체력 저하와 집중력 저하 가능성이 있습니다. "
            "식사를 거르지 말고 단백질과 에너지원이 포함된 식사를 일정하게 유지해 보세요. "
            "피로가 지속되거나 체중 변화가 계속되면 의료진 평가를 받아 원인을 확인하는 것이 좋습니다."
        )
    elif nutrition_code == "UNDERWEIGHT_BORDERLINE":
        nutrition_guide = (
            "현재 영양 상태는 경계 수준으로 보여 식사 패턴과 체중 변화를 꾸준히 관찰하는 것이 좋습니다. "
            "한 끼를 건너뛰지 않도록 일정을 고정하고 균형 잡힌 식사를 유지해 보세요. "
            "이런 상태가 계속되면 의료진과 상담해 개인 상태에 맞는 관리 계획을 세우는 것을 권장합니다."
        )
    elif nutrition_code == "IRREGULAR_MEAL_PATTERN":
        nutrition_guide = (
            "식사 시간이 불규칙하면 에너지 변동이 커져 집중 유지가 어려워질 수 있습니다. "
            "알람이나 고정된 식사 시간을 활용해 규칙성을 조금씩 회복해 보세요. "
            "완벽하게 맞추기보다 실천 가능한 범위에서 천천히 개선하는 방식이 더 효과적입니다."
        )
    if {"UNDERWEIGHT_BORDERLINE", "IRREGULAR_MEAL_PATTERN"}.issubset(nutrition_codes):
        nutrition_guide = (
            "현재 영양 상태는 경계 수준으로 보여 식사 패턴과 체중 변화를 꾸준히 관찰하는 것이 좋습니다. "
            "식사 시간이 불규칙하면 에너지 변동이 커져 집중 유지가 어려워질 수 있으므로 알람이나 고정된 식사 시간을 활용해 "
            "규칙성을 회복해 보세요. 이런 상태가 지속되면 의료진과 상담해 개인 상태에 맞는 관리 계획을 세우는 것을 권장합니다."
        )

    sleep_guide = "수면 시간을 일정하게 유지하고 취침 전 자극적인 활동을 줄여 안정적인 수면 리듬을 만들어 보세요."
    if sleep_code == "SLEEP_HIGH_RISK":
        sleep_guide = (
            "수면 부족 또는 잦은 각성으로 인해 판단력과 주의력이 저하될 수 있습니다. "
            "오늘은 운전 및 고위험 활동을 자제하고 충분한 휴식을 취하고 의료진과의 상담을 권장합니다."
        )
    elif sleep_code == "SHORT_SLEEP":
        sleep_guide = (
            "현재 수면 시간이 부족한 상태입니다. 오후 카페인과 취침 전 음주는 피하고, 낮잠을 최소화하며 "
            "매일 같은 시간에 취침·기상하는 습관을 유지하시기 바랍니다. 심한 코골이나 무호흡 증상이 있다면 "
            "의료 상담을 권장합니다."
        )
    elif sleep_code == "INSOMNIA_ONSET":
        sleep_guide = (
            "잠들기까지 30분 이상 걸린다면, 취침 1시간 전부터는 PC나 스마트폰 사용을 줄이고 매일 같은 시간에 "
            "일어나는 습관을 유지해 보세요. 침대에 누워 20-30분이 지나도 잠이 오지 않으면 잠시 일어나 조용히 쉬다가 "
            "졸릴 때 다시 눕는 것이 도움이 됩니다. 낮에는 햇빛을 충분히 쬐고, 카페인은 하루 한 잔 정도(100-200mg)로 "
            "제한하며 취침 예정 시각 최소 8시간 전 이후에는 피하는 것이 좋습니다."
        )

    exercise_guide = "현재 활동량을 유지하면서 무리하지 않는 범위에서 규칙적인 움직임을 지속해 주세요."
    if exercise_code == "OVERWEIGHT_RISK":
        exercise_guide = (
            "현재 상태에서는 체중 관리가 필요할 가능성이 있어 식사 구성과 활동 패턴을 함께 점검하는 것이 좋습니다. "
            "부담이 적은 강도로 규칙적인 신체 활동을 시작하고 일상에서 지속 가능한 계획을 유지해 보세요. "
            "급격한 변화보다 점진적이고 꾸준한 개선이 장기적으로 더 안전하고 효과적입니다."
        )
    elif exercise_code == "LOW_ACTIVITY":
        exercise_guide = (
            "현재 신체 활동량이 부족한 편으로 보여 가벼운 걷기나 스트레칭부터 시작해 보세요. "
            "한 번에 강도를 높이기보다 시간을 조금씩 늘리면서 규칙성을 만드는 것이 중요합니다."
        )

    concentration_strategy = (
        "집중 유지가 필요한 시간에는 작업 구간과 휴식 구간을 나누고 취침 전에는 디지털 기기 사용을 줄여 보세요."
    )
    if digital_code == "SCREEN_OVERUSE":
        concentration_strategy = (
            "긴 화면 노출은 ADHD 환자에서 집중 저하와 수면 리듬 불안정으로 이어질 수 있습니다. "
            "현재 사용량이 높은 편으로 보여 전체 사용 시간을 급격히 줄이기보다 단계적으로 조절하는 것이 좋습니다. "
            "작업 중 정기적인 화면 휴식과 취침 전 비노출 시간을 고정해 작은 변화를 꾸준히 이어가 보세요."
        )

    caffeine_guide = "카페인은 시간대와 반응을 살피며 조절해 약물 복용 중 불편감을 최소화해 주세요."
    if caffeine_code == "CAFFEINE_HIGH_RISK":
        caffeine_guide = (
            "카페인 섭취가 높으면 ADHD 약물의 자극 효과가 커져 긴장, 집중 저하, 떨림, 수면 불편이 나타날 수 있습니다. "
            "카페인 양을 줄이면서 몸의 반응 변화를 관찰해 보세요. "
            "불편 증상이 악화되면 의료진과 상담해 복용과 생활 패턴을 함께 조정하는 것이 좋습니다."
        )

    smoking_guide = "약물 복용 중에는 흡연량 변화를 함께 기록해 몸의 반응을 확인하는 것이 도움이 됩니다."
    if smoking_code == "SMOKING_ACTIVE":
        smoking_guide = (
            "흡연은 중추신경계를 자극해 ADHD 약물의 효과나 부작용 양상에 영향을 줄 수 있습니다. "
            "심박 증가, 혈압 상승, 불안 같은 변화가 생길 수 있어 가능하면 흡연을 줄이거나 피하는 것이 좋습니다. "
            "약 복용 중 증상이 심해지면 의료진과 상의해 안전하게 조정해 보세요."
        )

    drinking_guide = "음주 계획이 있다면 복용 중인 약물과 수면 상태를 함께 고려해 신중하게 조절해 주세요."
    if alcohol_code == "ALCOHOL_REGULAR":
        drinking_guide = (
            "음주와 ADHD 약물 복용이 겹치면 수면 불안정, 집중 저하, 불안 증가가 나타날 수 있습니다. "
            "복용 기간에는 음주를 줄이거나 가능한 피하고 수면, 기분, 주의력 변화를 관찰해 보세요. "
            "불편 증상이 지속되면 의료진 상담을 권장합니다."
        )
    elif alcohol_code == "ALCOHOL_HIGH_RISK":
        drinking_guide = (
            "현재 음주 패턴은 건강에 부담을 줄 가능성이 있어 섭취를 줄이기 위한 조절이 필요합니다. "
            "혼자 조절이 어렵다면 전문 상담이나 치료 자원을 활용하는 것이 도움이 됩니다. "
            "심한 어지럼, 의식 저하, 극심한 불안이나 우울 증상이 나타나면 즉시 의료기관 진료를 받으세요."
        )

    return {
        "nutrition_guide": nutrition_guide,
        "exercise_guide": exercise_guide,
        "concentration_strategy": concentration_strategy,
        "sleep_guide": sleep_guide,
        "caffeine_guide": caffeine_guide,
        "smoking_guide": smoking_guide,
        "drinking_guide": drinking_guide,
        "general_health_guide": DEFAULT_HEALTHY_GENERAL_GUIDE,
    }


async def _generate_lifestyle_guide_with_llm(
    *,
    profile: UserHealthProfile,
    confirmed_ocr: dict[str, Any],
    flags: dict[str, bool],
) -> dict[str, str]:
    risk_codes = _build_risk_code_payload(profile)
    fallback = _build_guide_fallback(risk_codes=risk_codes)
    if not config.OPENAI_API_KEY:
        return fallback

    prompt_context = {
        "risk_codes": risk_codes,
        "profile": {
            "bmi": profile.bmi,
            "sleep_time_hours": profile.sleep_time_hours,
            "sleep_latency_minutes": profile.sleep_latency_minutes,
            "night_awakenings_per_week": profile.night_awakenings_per_week,
            "daytime_sleepiness": profile.daytime_sleepiness,
            "caffeine_mg": profile.caffeine_mg,
            "digital_time_hours": profile.digital_time_hours,
            "exercise_frequency_per_week": profile.exercise_frequency_per_week,
            "smoking": profile.smoking,
            "alcohol_frequency_per_week": profile.alcohol_frequency_per_week,
            "appetite_level": profile.appetite_level,
            "meal_regular": profile.meal_regular,
        },
        "flags": flags,
        "confirmed_ocr": confirmed_ocr,
    }
    user_prompt = (
        "다음 환자 데이터를 바탕으로 각 섹션별 risk_code를 우선 적용해 한국어 가이드를 작성해라. "
        "risk_code가 NONE인 섹션은 예방 중심의 짧은 문장을 제공해라. "
        f"조건 데이터: {json.dumps(prompt_context, ensure_ascii=False)}"
    )
    try:
        client = AsyncOpenAI(
            api_key=config.OPENAI_API_KEY,
            base_url=config.OPENAI_BASE_URL,
            timeout=config.LLM_TIMEOUT_SECONDS,
        )
        response = await client.chat.completions.create(
            model=config.OPENAI_GUIDE_MODEL,
            messages=[
                {"role": "system", "content": _GUIDE_SYSTEM_PROMPT},
                {"role": "user", "content": user_prompt},
            ],
            temperature=0.2,
            response_format={"type": "json_object"},
        )
        raw = response.choices[0].message.content or "{}"
        parsed = json.loads(raw)
        if isinstance(parsed, dict):
            for key, value in fallback.items():
                parsed.setdefault(key, value)
            return {key: str(value) for key, value in parsed.items()}
    except Exception:
        logging.getLogger(__name__).warning(
            "lifestyle guide LLM generation failed, using static fallback",
            exc_info=True,
        )
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

        profile = await UserHealthProfile.get_or_none(user_id=job.user_id)
        if not profile:
            raise ValueError(f"User health profile not found: {job.user_id}")

        confirmed_ocr = {}
        if isinstance(job.ocr_job.confirmed_result, dict):
            confirmed_ocr = cast(dict[str, Any], job.ocr_job.confirmed_result.get("confirmed_ocr", {}))
            if not confirmed_ocr:
                confirmed_ocr = cast(dict[str, Any], job.ocr_job.confirmed_result)
        if not confirmed_ocr and isinstance(job.ocr_job.structured_result, dict):
            confirmed_ocr = cast(dict[str, Any], job.ocr_job.structured_result.get("confirmed_ocr", {}))
            if not confirmed_ocr:
                confirmed_ocr = cast(dict[str, Any], job.ocr_job.structured_result)

        medication_guide = await _build_medication_guide(confirmed_ocr)
        flags = _build_lifestyle_flags(profile)
        risk_codes = _build_risk_code_payload(profile)
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
                        "generator": f"openai-{config.OPENAI_GUIDE_MODEL}"
                        if config.OPENAI_API_KEY
                        else "guide-fallback",
                        "prompt_version": GUIDE_PROMPT_VERSION,
                        "model_version": config.OPENAI_GUIDE_MODEL,
                        "source_references": [],
                        "adherence_rate_percent": profile.weekly_adherence_rate,
                        "source_attributions": [
                            "사용자 건강 프로필 입력 데이터",
                            "사용자 확인 OCR 처방 데이터",
                            "RAG 지식 소스(연동 예정)",
                        ],
                        "weekly_adherence_rate": profile.weekly_adherence_rate,
                        "active_lifestyle_sections": active_sections,
                        "risk_codes": risk_codes,
                        "personalized_guides": {
                            "medication_guide": medication_guide,
                            "lifestyle_guidance": lifestyle_guidance_map,
                        },
                        "llm": {
                            "model": config.OPENAI_GUIDE_MODEL,
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
