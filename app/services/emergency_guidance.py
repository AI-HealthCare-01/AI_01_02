from __future__ import annotations

from datetime import datetime
from typing import Any

from app.core import config
from app.core.logger import default_logger as logger
from app.services.llm import chat_completion

_ALLERGY_SYSTEM_PROMPT = """
You are a clinical medication safety guidance assistant.

Context:
The user may be at risk of an allergic reaction to a prescribed medication.

Your task is to generate a medication safety guidance message in Korean.

Writing Guidelines:
- Use a professional and calm clinical tone.
- Explain that the prescribed medication may contain ingredients that could trigger an allergic reaction.
- Clearly advise the user not to take the medication until consulting a healthcare professional.
- Recommend contacting a doctor or pharmacist promptly.
- Mention that severe allergic symptoms (such as breathing difficulty or rash) require immediate medical attention.
- Do not make a definitive diagnosis.
- Do not use bullet points or lists.
- Write in natural paragraph form.
- Output only the final guidance message in Korean.

Length:
2–3 sentences.
""".strip()

_NUTRITION_SYSTEM_PROMPT = """
You are a clinical nutrition guidance assistant.

Context:
The user may be experiencing a potential nutritional deficiency or undernutrition.

Your task is to generate a health guidance message in Korean that informs the user about possible nutritional concerns and encourages appropriate medical consultation.

Writing Guidelines:
- Use a calm, professional, and medically responsible tone.
- Explain that the user's current condition may suggest a low body weight or possible nutritional deficiency.
- Mention that if the condition continues, it may affect immunity, muscle mass, energy level, or concentration.
- Encourage the user to seek medical evaluation to assess nutritional status and identify possible causes.
- Do not make a definitive medical diagnosis.
- Do not mention exact numerical values such as BMI or scores.
- Do not use bullet points or lists.
- Write in natural paragraph form.
- Output only the final guidance message in Korean.

Length:
3–4 sentences.
""".strip()

_SLEEP_SYSTEM_PROMPT = """
You are a clinical sleep health guidance assistant.

Context:
The user may be experiencing insufficient sleep or frequent nighttime awakenings, which could affect alertness and daily functioning.

Your task is to generate a safety-oriented sleep guidance message in Korean.

Writing Guidelines:
- Use a calm, professional, and medically responsible tone.
- Explain that insufficient sleep or frequent awakenings may reduce alertness, attention, or judgment.
- Advise the user to avoid driving or engaging in high-risk activities if they feel excessively sleepy or fatigued.
- Encourage the user to prioritize adequate rest and recovery.
- Recommend consulting a healthcare professional if sleep problems continue.
- Do not make a definitive medical diagnosis.
- Do not mention specific numeric values such as hours of sleep or scores.
- Do not use bullet points or lists.
- Write in natural paragraph form.
- Output only the final guidance message in Korean.

Length:
2–3 sentences.
""".strip()

_MEDICATION_DDAY_SYSTEM_PROMPT = """
You are a clinical medication adherence guidance assistant specializing in ADHD care.

Context:
The user is currently taking ADHD medication and the remaining supply of the medication is running low.
You will also receive information about how many days of medication remain.

Your task is to generate a short medication management guidance message in Korean that encourages the user to check their medical appointment schedule before the medication runs out.

Writing Guidelines:
- Use a calm, supportive, and practical tone.
- Clearly mention how many days of medication remain and include this information naturally in the message.
- Inform the user that their current ADHD medication supply is running low.
- Encourage the user to check their upcoming medical appointment or schedule a consultation in advance so that medication is not interrupted.
- Suggest confirming available appointment times at a convenient time.
- Do not make a medical diagnosis.
- Do not use bullet points or lists.
- Write in natural paragraph form.
- Output only the final guidance message in Korean.

Length:
2–3 sentences.
""".strip()


def _safe_positive_int(value: Any, default: int = 0) -> int:
    try:
        parsed = int(value)
    except (TypeError, ValueError):
        return default
    return parsed if parsed >= 0 else default


def compute_sleep_hours(*, bed_time: str | None, wake_time: str | None) -> float | None:
    if not bed_time or not wake_time:
        return None
    try:
        bed = datetime.strptime(bed_time, "%H:%M")
        wake = datetime.strptime(wake_time, "%H:%M")
    except ValueError:
        return None
    delta = (wake - bed).total_seconds() / 3600
    if delta < 0:
        delta += 24
    return round(delta, 2)


def compute_bmi_from_basic_info(basic_info: dict[str, Any]) -> float | None:
    height_cm = basic_info.get("height_cm")
    weight_kg = basic_info.get("weight_kg")
    if height_cm is None or weight_kg is None:
        return None
    try:
        height_m = float(height_cm) / 100
        if height_m <= 0:
            return None
        return float(weight_kg) / (height_m * height_m)
    except (TypeError, ValueError, ZeroDivisionError):
        return None


def is_nutrition_guide_condition_1(*, basic_info: dict[str, Any], nutrition_input: dict[str, Any]) -> bool:
    appetite_score = nutrition_input.get("appetite_score")
    meal_regular = nutrition_input.get("is_meal_regular")
    low_appetite_irregular_meal = appetite_score is not None and appetite_score <= 2 and (meal_regular is False)
    bmi = compute_bmi_from_basic_info(basic_info)
    low_bmi = bmi is not None and bmi <= 17
    return low_appetite_irregular_meal or low_bmi


def is_sleep_guide_condition_1(*, sleep_input: dict[str, Any]) -> bool:
    sleep_hours = compute_sleep_hours(
        bed_time=str(sleep_input.get("bed_time") or ""),
        wake_time=str(sleep_input.get("wake_time") or ""),
    )
    awakenings = _safe_positive_int(sleep_input.get("night_awakenings_per_week"))
    sleepiness_score = _safe_positive_int(sleep_input.get("daytime_sleepiness_score"))
    if sleep_hours is not None and sleep_hours <= 4:
        return True
    if sleep_hours is not None and sleep_hours <= 6 and awakenings >= 4:
        return True
    return sleepiness_score >= 8


def build_allergy_medication_guidance(*, medication_name: str, allergy_substance: str) -> str:
    return (
        f"현재 처방된 {medication_name}에는 {allergy_substance}과 관련된 알레르기 반응을 유발할 수 있는 성분이 포함되었을 가능성이 있어 주의가 필요합니다. "
        "의료진과 확인하기 전에는 임의로 복용하지 마시고, 가능한 한 빠르게 담당 의사 또는 약사에게 상담을 요청해 주세요. "
        "호흡곤란, 전신 발진 같은 심한 알레르기 증상이 나타나면 즉시 응급의료기관에서 진료를 받으시기 바랍니다."
    )


def build_nutrition_guidance() -> str:
    return (
        "현재 상태는 체중 저하나 영양 불균형 가능성을 시사할 수 있어 식사 상태를 주의 깊게 확인할 필요가 있습니다. "
        "이런 상태가 지속되면 면역력 저하, 근육량 감소, 피로감 증가와 함께 집중력 저하로 이어질 수 있습니다. "
        "원인 확인과 영양 상태 평가를 위해 의료진 상담을 받아 보시고, 개인 상태에 맞는 관리 계획을 세우는 것을 권장드립니다."
    )


def build_sleep_guidance() -> str:
    return (
        "수면 부족이나 잦은 각성은 주의력과 판단력을 떨어뜨려 일상 기능과 안전에 영향을 줄 수 있습니다. "
        "졸림이나 피로가 심하게 느껴질 때는 운전이나 위험 작업을 피하고 충분한 휴식과 회복을 우선해 주세요. "
        "수면 문제가 반복된다면 의료진 상담을 통해 원인을 확인하고 적절한 관리를 시작하시기 바랍니다."
    )


def build_medication_dday_guidance(*, medication_name: str, remaining_days: int) -> str:
    return (
        f"현재 복용 중인 {medication_name}의 남은 분량이 {remaining_days}일치로 확인되어 약이 곧 부족해질 수 있습니다. "
        "복약이 중단되지 않도록 다음 진료 일정을 미리 확인하거나 사전 상담 예약을 진행해 주세요. "
        "가능한 시간대의 예약 가능 여부도 함께 확인해 두시면 복약 관리에 도움이 됩니다."
    )


async def _generate_message_with_llm(*, system_prompt: str, user_prompt: str, fallback: str) -> str:
    if not config.OPENAI_API_KEY:
        return fallback
    try:
        content = await chat_completion(
            model=config.OPENAI_GUIDE_MODEL,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            temperature=0.2,
        )
        cleaned = content.strip()
        return cleaned or fallback
    except Exception:
        logger.warning("LLM guidance generation failed, using static fallback", exc_info=True)
        return fallback


async def generate_allergy_medication_guidance(*, medication_name: str, allergy_substance: str) -> str:
    fallback = build_allergy_medication_guidance(medication_name=medication_name, allergy_substance=allergy_substance)
    return await _generate_message_with_llm(
        system_prompt=_ALLERGY_SYSTEM_PROMPT,
        user_prompt=(
            f"알레르기 성분: {allergy_substance}\n"
            f"처방 의심 약물: {medication_name}\n"
            "위 정보를 반영해 최종 안내 문구만 한국어로 작성하세요."
        ),
        fallback=fallback,
    )


async def generate_nutrition_guidance() -> str:
    fallback = build_nutrition_guidance()
    return await _generate_message_with_llm(
        system_prompt=_NUTRITION_SYSTEM_PROMPT,
        user_prompt="사용자가 영양 저하 위험 조건을 충족했습니다. 최종 안내 문구만 한국어로 작성하세요.",
        fallback=fallback,
    )


async def generate_sleep_guidance() -> str:
    fallback = build_sleep_guidance()
    return await _generate_message_with_llm(
        system_prompt=_SLEEP_SYSTEM_PROMPT,
        user_prompt="사용자가 수면 고위험 조건을 충족했습니다. 최종 안내 문구만 한국어로 작성하세요.",
        fallback=fallback,
    )


async def generate_medication_dday_guidance(*, medication_name: str, remaining_days: int) -> str:
    fallback = build_medication_dday_guidance(medication_name=medication_name, remaining_days=remaining_days)
    return await _generate_message_with_llm(
        system_prompt=_MEDICATION_DDAY_SYSTEM_PROMPT,
        user_prompt=(
            f"약물명: {medication_name}\n"
            f"남은 일수: {remaining_days}\n"
            "위 정보를 반영해 최종 안내 문구만 한국어로 작성하세요."
        ),
        fallback=fallback,
    )
