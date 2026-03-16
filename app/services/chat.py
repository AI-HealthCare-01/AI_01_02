import asyncio
import json
import re
from collections.abc import AsyncGenerator
from datetime import datetime, timedelta
from typing import Any

from app.core import config
from app.core.exceptions import AppException, ErrorCode
from app.core.logger import default_logger as logger
from app.models.chat import ChatMessage, ChatMessageStatus, ChatRole, ChatSession, ChatSessionStatus
from app.models.health_profiles import UserHealthProfile
from app.models.reminders import MedicationReminder
from app.models.users import User
from app.services.llm import chat_completion, json_completion, stream_chat_completion
from app.services.rag import hybrid_search

# REQ-049: 프롬프트 버전 관리
CHAT_PROMPT_VERSION = "v1.6"

_GUARDRAIL_KEYWORDS = frozenset(["자살", "자해", "죽고 싶", "죽이고", "약물 오남용", "마약", "범죄"])
_EMERGENCY_MESSAGE = (
    "⚠️ 중요한 안내\n\n"
    "많이 힘들었겠어요. 지금 말씀하신 내용에는 자해 또는 생명과 관련된 민감한 요소가 포함되어 있어\n"
    "제가 직접적인 답변을 제공할 수 없습니다.\n\n"
    "하지만 이런 고민을 혼자서 감당할 필요는 없습니다.\n"
    "지금 바로 주변의 신뢰할 수 있는 사람이나 전문가에게 도움을 요청해 주세요.\n\n"
    "📞 도움을 받을 수 있는 곳\n"
    "• 자살예방상담전화: 1393\n"
    "• 정신건강상담전화: 1577-0199\n\n"
    "지금 즉시 위험하다고 느껴지면 119 또는 가까운 응급실에 바로 도움을 요청하세요."
)

_REFERENCE_SELECTION_PROMPT = (
    "당신은 챗봇 답변에 실제로 반영된 참고 문헌만 고르는 분류기입니다. "
    '반드시 JSON으로만 응답하세요: {"used_document_ids": ["id1", "id2"]}\n'
    "- 검색되었다는 이유만으로 문서를 포함하지 마세요.\n"
    "- 답변 내용에 직접 반영된 문서만 포함하세요.\n"
    "- 불확실하면 제외하세요.\n"
    "- 후보에 없는 id는 절대 만들지 마세요.\n"
    "- 해당 문서가 실제로 쓰이지 않았다면 빈 배열을 반환하세요."
)

_REFERENCE_SELECTION_STOPWORDS = frozenset(
    [
        "adhd",
        "관련",
        "대한",
        "환자",
        "관리",
        "안내",
        "정보",
        "내용",
        "설명",
        "경우",
        "사용",
        "증상",
        "질문",
        "답변",
        "도움",
        "주의",
        "일반적",
        "가능",
        "권장",
        "합니다",
        "하세요",
    ]
)

# REQ-049: 시스템 프롬프트 버전 관리
_SYSTEM_PROMPT_BASE = (
    "당신은 ADHD 환자를 돕는 건강 관리 챗봇입니다.\n\n"
    "사용자의 질문에 대해 정확하고 이해하기 쉬운 정보를 제공해야 합니다.\n"
    "응답은 항상 한국어로 작성합니다.\n\n"
    "다음 규칙을 반드시 지켜주세요.\n\n"
    "1. 가독성\n"
    "- 응답은 한 덩어리의 긴 문장이 아니라 짧은 문단으로 나눕니다.\n"
    "- 필요하면 목록 형태(•)를 사용합니다.\n"
    "- 정보 전달을 돕기 위해 적절한 이모지(💊 ⚠️ ✅ ☕ 등)를 사용할 수 있습니다.\n"
    "- 각 문단은 2~3문장을 넘지 않도록 합니다.\n\n"
    "2. 의료 정보 제공 방식\n"
    "- ADHD 약물, 생활 습관, 수면, 카페인, 운동 등과 관련된 질문에 대해 설명합니다.\n"
    "- 의학적 정보를 제공할 때는 과도한 단정 표현을 피하고 일반적인 권장 사항 중심으로 설명합니다.\n"
    "- 가능하면 실생활에서 이해하기 쉬운 예시를 함께 제공합니다.\n\n"
    "3. 안전 정책\n"
    "다음과 같은 내용이 포함된 질문에는 직접적인 답변을 제공하지 않습니다.\n"
    "- 자살\n"
    "- 자해\n"
    "- 살인\n"
    "- 폭력\n"
    "- 죽음 관련 위험 행동\n\n"
    "이러한 경우 다음과 같은 방식으로 응답합니다.\n\n"
    "- 사용자의 감정을 존중하는 문장으로 시작합니다.\n"
    "- 해당 질문에는 답변할 수 없음을 설명합니다.\n"
    "- 도움을 받을 수 있는 상담 기관 정보를 제공합니다.\n\n"
    "예시 구조:\n\n"
    "⚠️ 중요한 안내\n\n"
    "현재 질문에는 자해 또는 생명과 관련된 민감한 내용이 포함되어 있어\n"
    "제가 직접적인 답변을 제공할 수 없습니다.\n\n"
    "하지만 이런 고민을 혼자서 감당할 필요는 없습니다.\n\n"
    "📞 도움을 받을 수 있는 곳\n"
    "• 자살 예방 상담전화: 1393\n"
    "• 정신건강 상담전화: 1577-0199\n\n"
    "주변의 신뢰할 수 있는 사람이나 전문가와 이야기하는 것이 도움이 될 수 있습니다.\n\n"
    "4. 대화 스타일\n"
    "- 사용자를 비판하거나 판단하지 않습니다.\n"
    "- 친절하고 차분한 어조를 유지합니다.\n"
    "- 너무 긴 답변은 피하고 핵심 정보를 중심으로 설명합니다.\n\n"
    "5. 정보 출처\n"
    "RAG를 통해 제공된 문헌이 있는 경우, 해당 정보를 기반으로 설명합니다.\n\n"
    "6. 후속 질문\n"
    "- 답변 마지막에는 사용자가 다음으로 이어서 물어볼 수 있는 짧은 후속 질문 1~3개를 제안합니다."
)

_LIFESTYLE_PROMPT_GUIDANCE = (
    "\n\n[개인화 지침]\n"
    "- 제공된 생활습관 정보를 반영해 수면, 카페인, 운동, 디지털 사용 습관에 맞춘 개인화된 조언을 제공합니다."
)

_MEDICATION_PROMPT_GUIDANCE = (
    "\n\n[복약 개인화 지침]\n"
    "- [사용자 복약 정보]가 제공되면 약물 관련 질문에서 그 정보를 우선 반영합니다.\n"
    "- 카페인, 음주, 부작용, 상호작용 질문에서는 저장된 복약 정보를 함께 고려합니다.\n"
    "- 목록에 없는 약을 사용자가 복용 중이라고 단정하지 않습니다."
)

# REQ-034: 의도 분류 프롬프트
_INTENT_PROMPT = (
    "사용자 메시지의 의도를 분류하세요. "
    '반드시 JSON으로만 응답하세요: {"intent": "medical" | "chitchat" | "emergency"}\n'
    "- emergency: 자살/자해/위기/범죄/약물오남용\n"
    "- medical: 복약/부작용/생활습관/수면/영양/ADHD 관련 질문\n"
    "- chitchat: 그 외 일상 대화"
)

_MAX_HISTORY_TURNS = 10

_PROMPT_OPTIONS = [
    {"id": "1", "label": "복약 방법이 궁금해요", "category": "medication"},
    {"id": "2", "label": "부작용이 걱정돼요", "category": "side_effect"},
    {"id": "3", "label": "생활습관 개선 방법이 궁금해요", "category": "lifestyle"},
    {"id": "4", "label": "직접 질문할게요", "category": "free"},
]

_MEDICATION_CONTEXT_PATTERNS = (
    r"복약",
    r"복용",
    r"복용량",
    r"용량",
    r"부작용",
    r"카페인",
    r"커피",
    r"술",
    r"음주",
    r"알코올",
    r"에너지\s*음료",
    r"에너지\s*드링크",
    r"상호\s*작용",
    r"상호작용",
    r"기전",
    r"약물",
    r"처방약",
    r"먹는\s*약",
    r"복용\s*중인\s*약",
    r"\bmechanism\b",
    r"\bdosage\b",
    r"\bdose\b",
    r"\bcoffee\b",
    r"\bcaffeine\b",
    r"\balcohol\b",
    r"\binteraction(s)?\b",
    r"\bside\s*effect(s)?\b",
)

_ADHD_RISK_DOUBLE_DOSE_PATTERNS = (
    r"두\s*(알|정|캡슐|개)",
    r"2\s*(알|정|캡슐|개)",
    r"한\s*번\s*더\s*(먹|복용)",
    r"추가\s*(복용|로\s*먹)",
    r"double\s*dose",
    r"두\s*배\s*(로)?\s*(먹|복용)",
)

_ADHD_RISK_CAFFEINE_KEYWORDS = ("커피", "카페인", "에너지음료", "에너지 음료", "에너지드링크", "에너지 드링크")
_ADHD_RISK_SLEEP_KEYWORDS = ("밤새", "밤샘", "안 자고", "한숨도 안 자", "2시간만 자", "두 시간만 자", "수면 없이")


def _build_profile_context(user_health_profile: UserHealthProfile | None) -> str:
    """REQ-032: 사용자 프로필/약 정보를 시스템 프롬프트에 주입"""
    if not user_health_profile:
        return ""
    parts = []
    if user_health_profile.height_cm and user_health_profile.weight_kg:
        parts.append(f"키 {user_health_profile.height_cm}cm, 체중 {user_health_profile.weight_kg}kg")
    if user_health_profile.drug_allergies:
        parts.append(f"약물 알러지: {', '.join(user_health_profile.drug_allergies)}")
    if not parts:
        return ""
    return "\n\n[사용자 건강 정보]\n" + "\n".join(parts)


def _to_float(value: Any) -> float | None:
    if isinstance(value, bool):
        return None
    if isinstance(value, int | float):
        return float(value)
    if isinstance(value, str) and value.strip():
        try:
            return float(value.strip())
        except ValueError:
            return None
    return None


def _format_metric(value: float) -> str:
    return str(int(value)) if value.is_integer() else str(round(value, 2)).rstrip("0").rstrip(".")


def _build_lifestyle_context(
    user_health_profile: UserHealthProfile | None,
    *,
    intent: str,
) -> str:
    if intent != "medical" or not user_health_profile:
        return ""

    sleep_hours = _to_float(user_health_profile.sleep_time_hours)
    caffeine_cups = _to_float(user_health_profile.caffeine_cups_per_day)
    exercise_frequency = _to_float(user_health_profile.exercise_frequency_per_week)
    smartphone_hours = _to_float(user_health_profile.smartphone_hours_per_day)
    alcohol_frequency = _to_float(user_health_profile.alcohol_frequency_per_week)

    parts = [
        "\n\n[사용자 생활습관 정보]",
        "일반적인 설명 대신 아래 생활습관 정보를 반영해 개인화된 ADHD 관리 조언을 제공하세요.",
    ]

    if sleep_hours is not None:
        parts.append(f"• 예상 수면 시간 {_format_metric(sleep_hours)}시간")
    if caffeine_cups is not None:
        parts.append(f"• 카페인 섭취 하루 {_format_metric(caffeine_cups)}잔")
    if exercise_frequency is not None:
        parts.append(f"• 주간 운동 빈도 {_format_metric(exercise_frequency)}회")
    if smartphone_hours is not None:
        parts.append(f"• 스마트폰 사용 하루 {_format_metric(smartphone_hours)}시간")
    if alcohol_frequency is not None:
        parts.append(f"• 음주 빈도 주 {_format_metric(alcohol_frequency)}회")

    return "\n".join(parts) if len(parts) > 2 else ""


def _is_medication_related_question(*, intent: str, message: str) -> bool:
    if intent != "medical":
        return False

    normalized = message.lower().strip()
    return any(re.search(pattern, normalized) for pattern in _MEDICATION_CONTEXT_PATTERNS)


def _format_medication_reminder_line(reminder: MedicationReminder) -> str:
    details = [reminder.medication_name]
    if reminder.dose_text:
        details.append(f"용량 {reminder.dose_text}")
    if isinstance(reminder.schedule_times, list) and reminder.schedule_times:
        details.append(f"복용 시간 {', '.join(str(t) for t in reminder.schedule_times)}")
    if reminder.daily_intake_count is not None:
        details.append(f"하루 복용 횟수 {reminder.daily_intake_count}회")
    if reminder.dispensed_date is not None:
        details.append(f"조제일 {reminder.dispensed_date.isoformat()}")
    if reminder.total_days is not None:
        details.append(f"총 투약일수 {reminder.total_days}일")
    return "• " + " / ".join(details)


def _medication_names(reminders: list[MedicationReminder]) -> str:
    names = [reminder.medication_name for reminder in reminders[:5] if reminder.medication_name]
    return ", ".join(names)


def _build_medication_context(reminders: list[MedicationReminder]) -> str:
    if not reminders:
        return (
            "\n\n[사용자 복약 정보]\n"
            "현재 DB에 저장된 복약 정보가 없습니다. 사용자의 실제 복용 약을 단정하지 말고, "
            "저장된 약 정보가 없음을 짧게 알린 뒤 복용 중인 약 이름을 확인하도록 안내하세요."
        )

    parts = [
        "\n\n[사용자 복약 정보]",
        "약물 관련 질문에서는 아래 사용자의 저장된 복약 정보를 우선 반영하세요.",
        "목록에 없는 약을 사용자가 복용 중이라고 단정하지 마세요.",
    ]
    parts.extend(_format_medication_reminder_line(reminder) for reminder in reminders)
    return "\n".join(parts)


def _detect_adhd_risk_behavior(message: str) -> str | None:
    normalized = message.lower().strip()

    if any(re.search(pattern, normalized) for pattern in _ADHD_RISK_DOUBLE_DOSE_PATTERNS):
        return "double_dose"

    if any(keyword in normalized for keyword in _ADHD_RISK_CAFFEINE_KEYWORDS):
        if re.search(r"([4-9]|\d{2,})\s*(잔|캔|샷|shot)", normalized):
            return "excessive_caffeine"
        if any(keyword in normalized for keyword in ("과다", "많이", "여러 잔", "밤새려고", "잠 안 자려고", "계속")):
            return "excessive_caffeine"

    if any(keyword in normalized for keyword in _ADHD_RISK_SLEEP_KEYWORDS):
        return "sleep_deprivation"

    return None


def _build_follow_up_section(
    *,
    message: str,
    intent: str,
    medication_related: bool,
    lifestyle_context_available: bool,
    risk_type: str | None = None,
) -> str:
    if intent == "emergency":
        return ""

    normalized = message.lower()
    if risk_type == "double_dose":
        questions = [
            "현재 처방된 정확한 1회 용량도 같이 확인해볼까요?",
            "복용을 빼먹었을 때 어떻게 대응하는지도 궁금하신가요?",
            "주의해야 할 과다복용 증상도 정리해드릴까요?",
        ]
    elif risk_type == "excessive_caffeine":
        questions = [
            "ADHD 약과 카페인 간격도 같이 볼까요?",
            "하루 카페인 양을 줄이는 방법도 알려드릴까요?",
            "에너지음료 대신 덜 자극적인 대안도 궁금하신가요?",
        ]
    elif risk_type == "sleep_deprivation":
        questions = [
            "수면 부족이 ADHD 증상에 미치는 영향도 볼까요?",
            "복용 시간 조정이 도움이 될 수 있는지도 알려드릴까요?",
            "잠들기 쉬운 저녁 루틴도 같이 정리해드릴까요?",
        ]
    elif medication_related:
        if any(keyword in normalized for keyword in ("카페인", "커피", "술", "음주", "알코올", "에너지")):
            questions = [
                "복용 중인 약과 카페인 간격도 궁금하신가요?",
                "음주가 약효나 부작용에 미치는 영향도 볼까요?",
                "주의해야 할 상호작용 신호도 정리해드릴까요?",
            ]
        elif any(keyword in normalized for keyword in ("부작용", "side effect")):
            questions = [
                "부작용이 생겼을 때 바로 병원에 가야 하는 신호도 볼까요?",
                "복용 시간 조정으로 완화될 수 있는지도 알려드릴까요?",
                "식사와 함께 복용하는 팁도 궁금하신가요?",
            ]
        else:
            questions = [
                "복용 시간과 지속 시간 차이도 궁금하신가요?",
                "카페인이나 음주와의 상호작용도 같이 볼까요?",
                "놓친 약을 어떻게 처리해야 하는지도 알려드릴까요?",
            ]
    else:
        if any(keyword in normalized for keyword in ("수면", "잠", "sleep")):
            questions = [
                "취침 전 스마트폰 사용을 줄이는 방법도 볼까요?",
                "카페인 섭취 시간을 조정하는 팁도 궁금하신가요?",
                "ADHD 약 복용 시간과 수면의 관계도 알려드릴까요?",
            ]
        elif any(keyword in normalized for keyword in ("운동", "exercise")):
            questions = [
                "집중력에 도움이 되는 운동 시간대도 볼까요?",
                "짧게 시작할 수 있는 운동 루틴도 궁금하신가요?",
                "운동과 수면을 함께 개선하는 방법도 알려드릴까요?",
            ]
        elif lifestyle_context_available:
            questions = [
                "수면 습관부터 같이 점검해볼까요?",
                "카페인이나 스마트폰 사용이 ADHD에 미치는 영향도 볼까요?",
                "운동 루틴을 ADHD 관리에 맞게 조정하는 방법도 궁금하신가요?",
            ]
        else:
            questions = [
                "ADHD 약 복용 타이밍도 같이 볼까요?",
                "수면과 ADHD 증상의 관계도 궁금하신가요?",
                "집중력에 도움이 되는 생활 습관도 더 알려드릴까요?",
            ]

    return "\n\n더 도와드릴 수 있는 내용\n" + "\n".join(f"• {question}" for question in questions[:3])


def _append_follow_up_questions(
    answer: str,
    *,
    message: str,
    intent: str,
    medication_related: bool,
    lifestyle_context_available: bool,
    risk_type: str | None = None,
) -> str:
    if any(marker in answer for marker in ("더 도와드릴 수 있는 내용", "다음으로 궁금할 수 있는 내용")):
        return answer

    follow_up = _build_follow_up_section(
        message=message,
        intent=intent,
        medication_related=medication_related,
        lifestyle_context_available=lifestyle_context_available,
        risk_type=risk_type,
    )
    return answer.rstrip() + follow_up if follow_up else answer


def _build_adhd_risk_message(risk_type: str, reminders: list[MedicationReminder]) -> str:
    medication_names = _medication_names(reminders)
    medication_line = f"\n• 현재 저장된 복약 정보: {medication_names}" if medication_names else ""

    if risk_type == "double_dose":
        return (
            "⚠️ 복약 안전 안내\n\n"
            "처방된 용량보다 더 많이 복용하는 것은 위험할 수 있습니다.\n"
            "ADHD 약은 심장 두근거림, 불안, 혈압 상승, 불면 같은 부작용이 더 심해질 수 있습니다.\n\n"
            "✅ 지금 권장되는 행동\n"
            "• 추가 복용은 하지 마세요.\n"
            "• 오늘 복용량이 헷갈리면 처방전, 약 봉투, 복약 알림을 먼저 확인하세요.\n"
            "• 이미 더 복용했거나 두근거림, 어지럼, 흉통이 있으면 의료진 또는 약사와 바로 상의하세요."
            f"{medication_line}"
        )

    if risk_type == "excessive_caffeine":
        return (
            "⚠️ 카페인 과다 섭취 주의\n\n"
            "카페인을 과하게 섭취하면 ADHD 증상과 약물 부작용이 더 심해질 수 있습니다.\n"
            "특히 불안, 심박수 증가, 손떨림, 불면이 악화될 수 있습니다.\n\n"
            "✅ 지금 권장되는 행동\n"
            "• 추가 카페인 섭취는 잠시 멈추세요.\n"
            "• 물을 충분히 마시고, 가슴 두근거림이나 심한 불안이 있으면 진료를 권합니다.\n"
            "• ADHD 약을 복용 중이라면 카페인과의 간격과 총량을 의료진과 상의하세요."
            f"{medication_line}"
        )

    return (
        "⚠️ 수면 부족 안전 안내\n\n"
        "극심한 수면 부족은 집중력 저하, 충동성 악화, 불안 증가로 이어질 수 있습니다.\n"
        "ADHD 약을 복용 중이면 불면이나 심박수 증가가 더 도드라질 수 있습니다.\n\n"
        "✅ 지금 권장되는 행동\n"
        "• 의도적으로 밤을 새우거나 수면을 줄이는 행동은 피하세요.\n"
        "• 오늘은 카페인과 야간 스마트폰 사용을 줄이고 회복 수면을 우선하세요.\n"
        "• 수면 부족이 반복되면 약 복용 시간과 수면 계획을 의료진과 함께 조정하는 것이 좋습니다."
        f"{medication_line}"
    )


_RAG_DOC_MAX_CHARS = 600


def _build_rag_context(rag_docs: list) -> str:
    """REQ-036: 검색된 근거 문서를 프롬프트 컨텍스트로 변환"""
    if not rag_docs:
        return ""
    parts = ["\n\n[참고 의학 문서]"]
    for i, doc in enumerate(rag_docs, 1):
        content = doc.content[:_RAG_DOC_MAX_CHARS] + "…" if len(doc.content) > _RAG_DOC_MAX_CHARS else doc.content
        parts.append(f"{i}. [{doc.title}] {content}")
    return "\n".join(parts)


def _tokenize_reference_text(text: str) -> set[str]:
    return {
        token.lower()
        for token in re.findall(r"[0-9A-Za-z가-힣]+", text)
        if len(token) >= 2 and token.lower() not in _REFERENCE_SELECTION_STOPWORDS
    }


def _fallback_reference_dicts(answer: str, rag_docs: list) -> list[dict[str, Any]]:
    answer_tokens = _tokenize_reference_text(answer)
    selected: list[dict[str, Any]] = []
    for doc in rag_docs:
        title_source_tokens = _tokenize_reference_text(f"{doc.title} {doc.source}")
        content_tokens = _tokenize_reference_text(doc.content)
        if answer_tokens & title_source_tokens or len(answer_tokens & content_tokens) >= 2:
            selected.append(doc.to_reference_dict())
    return selected


async def _select_used_references(answer: str, rag_docs: list) -> list[dict[str, Any]]:
    if not answer.strip() or not rag_docs:
        return []

    candidates = [
        {
            "document_id": doc.doc_id,
            "title": doc.title,
            "source": doc.source,
            "content": doc.content,
        }
        for doc in rag_docs
    ]

    try:
        result = await json_completion(
            model=config.OPENAI_CHAT_MODEL,
            messages=[
                {"role": "system", "content": _REFERENCE_SELECTION_PROMPT},
                {"role": "user", "content": f"[챗봇 답변]\n{answer}"},
                {"role": "user", "content": f"[후보 문헌]\n{json.dumps(candidates, ensure_ascii=False)}"},
            ],
            temperature=0.0,
        )
        raw_ids = result.get("used_document_ids", [])
        if not isinstance(raw_ids, list):
            raw_ids = []
        allowed_ids = {doc.doc_id for doc in rag_docs}
        selected_ids = [doc_id for doc_id in raw_ids if isinstance(doc_id, str) and doc_id in allowed_ids]
        if selected_ids:
            selected_id_set = set(selected_ids)
            return [doc.to_reference_dict() for doc in rag_docs if doc.doc_id in selected_id_set]
    except Exception:
        logger.warning("reference selection failed", exc_info=True)

    return _fallback_reference_dicts(answer, rag_docs)


async def _get_user_medication_reminders(*, user: User) -> list[MedicationReminder]:
    try:
        reminders = await MedicationReminder.filter(user_id=user.id, enabled=True).order_by("-updated_at")
    except Exception:
        logger.warning("medication reminder load failed (user_id=%s)", user.id, exc_info=True)
        return []

    deduped: list[MedicationReminder] = []
    seen_names: set[str] = set()
    for reminder in reminders:
        name_key = reminder.medication_name.strip().lower()
        if not name_key or name_key in seen_names:
            continue
        seen_names.add(name_key)
        deduped.append(reminder)

    return deduped


async def _prepare_medication_context(
    *, user: User, intent: str, message: str, reminders: list[MedicationReminder] | None = None
) -> str:
    if not _is_medication_related_question(intent=intent, message=message):
        return ""

    deduped = reminders if reminders is not None else await _get_user_medication_reminders(user=user)
    return _build_medication_context(deduped)


async def _classify_intent(message: str) -> str:
    """REQ-034: LLM 기반 의도 분류 (emergency/medical/chitchat)"""
    try:
        result = await json_completion(
            model=config.OPENAI_CHAT_MODEL,
            messages=[
                {"role": "system", "content": _INTENT_PROMPT},
                {"role": "user", "content": message},
            ],
            temperature=0.0,
        )
        intent = result.get("intent", "medical")
        return intent if intent in ("emergency", "medical", "chitchat") else "medical"
    except Exception:
        logger.warning("intent classification failed, defaulting to 'medical'", exc_info=True)
        return "medical"


def _expired_session_ids(sessions: list[ChatSession], now: datetime) -> list[int]:
    return [
        s.id
        for s in sessions
        if s.last_activity_at is not None
        and (now - s.last_activity_at) >= timedelta(minutes=s.auto_close_after_minutes)
    ]


async def close_inactive_sessions() -> int:
    """REQ-044: auto_close_after_minutes 경과한 ACTIVE 세션을 CLOSED로 전환."""
    now = datetime.now(config.TIMEZONE)
    sessions = await ChatSession.filter(
        status=ChatSessionStatus.ACTIVE,
        deleted_at=None,
        last_activity_at__isnull=False,
    ).only("id", "auto_close_after_minutes", "last_activity_at")

    ids_to_close = _expired_session_ids(sessions, now)
    if ids_to_close:
        await ChatSession.filter(id__in=ids_to_close).update(
            status=ChatSessionStatus.CLOSED,
            updated_at=now,
        )
        # 고아 STREAMING 메시지를 FAILED로 전환
        await ChatMessage.filter(
            session_id__in=ids_to_close,
            status=ChatMessageStatus.STREAMING,
        ).update(status=ChatMessageStatus.FAILED)
    return len(ids_to_close)


class ChatService:
    async def get_prompt_options(self) -> list[dict]:
        return _PROMPT_OPTIONS

    async def create_session(self, *, user: User, title: str | None) -> ChatSession:
        return await ChatSession.create(
            user_id=user.id,
            title=title,
            last_activity_at=datetime.now(config.TIMEZONE),
        )

    async def _get_active_session(self, *, user: User, session_id: int) -> ChatSession:
        session = await ChatSession.get_or_none(id=session_id, user_id=user.id, deleted_at=None)
        if not session:
            raise AppException(ErrorCode.RESOURCE_NOT_FOUND, developer_message="세션을 찾을 수 없습니다.")
        return session

    async def delete_session(self, *, user: User, session_id: int) -> None:
        session = await self._get_active_session(user=user, session_id=session_id)
        session.deleted_at = datetime.now(config.TIMEZONE)
        session.status = ChatSessionStatus.CLOSED
        await session.save(update_fields=["deleted_at", "status", "updated_at"])

    async def list_messages(
        self, *, user: User, session_id: int, limit: int, offset: int
    ) -> tuple[list[ChatMessage], int]:
        await self._get_active_session(user=user, session_id=session_id)
        total = await ChatMessage.filter(session_id=session_id).count()
        messages = await ChatMessage.filter(session_id=session_id).order_by("-updated_at").offset(offset).limit(limit)
        return messages, total

    async def _prepare_rag_context(
        self, *, user: User, intent: str, message: str
    ) -> tuple[UserHealthProfile | None, list, bool, list[str]]:
        """프로필 조회 + RAG 검색을 동시 실행."""
        rag_docs: list = []
        needs_clarification = False
        retrieved_doc_ids: list[str] = []

        if intent == "medical":
            try:
                user_health_profile, (rag_docs, _rag_needs_clarification) = await asyncio.gather(
                    UserHealthProfile.get_or_none(user_id=user.id),
                    hybrid_search(message),
                )
                retrieved_doc_ids = [d.doc_id for d in rag_docs]
            except Exception:
                logger.warning("RAG hybrid_search failed (user_id=%s)", user.id, exc_info=True)
                user_health_profile = await UserHealthProfile.get_or_none(user_id=user.id)
        else:
            user_health_profile = await UserHealthProfile.get_or_none(user_id=user.id)

        return user_health_profile, rag_docs, needs_clarification, retrieved_doc_ids

    async def send_message(self, *, user: User, session_id: int, message: str) -> ChatMessage:
        session = await self._get_active_session(user=user, session_id=session_id)
        normalized_msg = message.lower().strip()
        intent = (
            "emergency" if any(kw in normalized_msg for kw in _GUARDRAIL_KEYWORDS) else await _classify_intent(message)
        )

        # REQ-035: 안전 가드레일 — emergency 차단
        early_msg = await self._check_early_exit(session=session, message=message, intent=intent)
        if early_msg is not None:
            return early_msg

        reminders = await _get_user_medication_reminders(user=user)
        risk_msg = await self._check_adhd_risk_exit(
            session=session,
            message=message,
            intent=intent,
            reminders=reminders,
        )
        if risk_msg is not None:
            return risk_msg

        (
            user_health_profile,
            rag_docs,
            needs_clarification,
            retrieved_doc_ids,
        ) = await self._prepare_rag_context(user=user, intent=intent, message=message)
        medication_related = _is_medication_related_question(intent=intent, message=message)
        medication_ctx = await _prepare_medication_context(
            user=user,
            intent=intent,
            message=message,
            reminders=reminders,
        )
        lifestyle_ctx = _build_lifestyle_context(user_health_profile, intent=intent)

        # REQ-042: 저유사도 재질문 유도
        clarification_msg = await self._check_clarification(
            session=session, message=message, intent=intent, needs_clarification=needs_clarification
        )
        if clarification_msg is not None:
            return clarification_msg

        # REQ-036: RAG 컨텍스트 + 프로필 컨텍스트로 시스템 프롬프트 구성
        profile_ctx = _build_profile_context(user_health_profile)
        rag_ctx = _build_rag_context(rag_docs)
        prompt_guidance = ""
        if lifestyle_ctx:
            prompt_guidance += _LIFESTYLE_PROMPT_GUIDANCE
        if medication_ctx:
            prompt_guidance += _MEDICATION_PROMPT_GUIDANCE
        system_content = _SYSTEM_PROMPT_BASE + prompt_guidance + profile_ctx + lifestyle_ctx + medication_ctx + rag_ctx

        # 최근 대화 이력 조회 (사용자 메시지 저장 전에 조회해야 off-by-one 방지)
        recent = await (
            ChatMessage.filter(session_id=session.id, role__in=[ChatRole.USER, ChatRole.ASSISTANT])
            .order_by("-created_at")
            .limit(_MAX_HISTORY_TURNS * 2)
        )
        history = [{"role": m.role.lower(), "content": m.content} for m in reversed(recent)]
        messages_payload = [{"role": "system", "content": system_content}] + history
        messages_payload.append({"role": "user", "content": message})

        # 사용자 메시지 저장
        await ChatMessage.create(
            session_id=session.id,
            role=ChatRole.USER,
            status=ChatMessageStatus.COMPLETED,
            content=message,
            intent_label=intent,
            prompt_version=CHAT_PROMPT_VERSION,
            model_version=config.OPENAI_CHAT_MODEL,
        )

        assistant_msg = await ChatMessage.create(
            session_id=session.id,
            role=ChatRole.ASSISTANT,
            status=ChatMessageStatus.PENDING,
            content="",
            intent_label=intent,
            references_json=[],
            retrieved_doc_ids=retrieved_doc_ids,
            prompt_version=CHAT_PROMPT_VERSION,
            model_version=config.OPENAI_CHAT_MODEL,
        )

        try:
            raw_reply = await chat_completion(model=config.OPENAI_CHAT_MODEL, messages=messages_payload)
            assistant_msg.references_json = await _select_used_references(raw_reply, rag_docs)
            assistant_msg.content = _append_follow_up_questions(
                raw_reply,
                message=message,
                intent=intent,
                medication_related=medication_related,
                lifestyle_context_available=bool(lifestyle_ctx),
            )
            assistant_msg.status = ChatMessageStatus.COMPLETED
        except Exception:
            assistant_msg.status = ChatMessageStatus.FAILED
            await assistant_msg.save(update_fields=["content", "status", "references_json", "updated_at"])
            logger.exception("chat_completion failed (session_id=%s)", session.id)
            raise AppException(ErrorCode.INTERNAL_ERROR) from None

        await assistant_msg.save(update_fields=["content", "status", "references_json", "updated_at"])
        await self._update_session_activity(session)
        return assistant_msg

    @staticmethod
    def _single_token_stream(content: str) -> AsyncGenerator[tuple[str, dict[str, Any]]]:
        async def _gen() -> AsyncGenerator[tuple[str, dict[str, Any]]]:
            yield "token", {"content": content}

        return _gen()

    async def _save_user_message(self, *, session: ChatSession, message: str, intent: str) -> None:
        await ChatMessage.create(
            session_id=session.id,
            role=ChatRole.USER,
            status=ChatMessageStatus.COMPLETED,
            content=message,
            intent_label=intent,
            prompt_version=CHAT_PROMPT_VERSION,
            model_version=config.OPENAI_CHAT_MODEL,
        )

    async def _update_session_activity(self, session: ChatSession) -> None:
        session.last_activity_at = datetime.now(config.TIMEZONE)
        await session.save(update_fields=["last_activity_at", "updated_at"])

    async def _check_early_exit(self, *, session: ChatSession, message: str, intent: str) -> ChatMessage | None:
        """가드레일 조기 종료. None이면 정상 진행."""
        if intent == "emergency":
            logger.warning(
                "guardrail_blocked",
                extra={"session_id": session.id, "message_preview": message[:50]},
            )
            await self._save_user_message(session=session, message=message, intent=intent)
            assistant_msg = await ChatMessage.create(
                session_id=session.id,
                role=ChatRole.ASSISTANT,
                status=ChatMessageStatus.COMPLETED,
                content=_EMERGENCY_MESSAGE,
                intent_label=intent,
                guardrail_blocked=True,
                guardrail_reason="위기 신호 감지",
                prompt_version=CHAT_PROMPT_VERSION,
                model_version=config.OPENAI_CHAT_MODEL,
            )
            await self._update_session_activity(session)
            return assistant_msg
        return None

    async def _check_adhd_risk_exit(
        self,
        *,
        session: ChatSession,
        message: str,
        intent: str,
        reminders: list[MedicationReminder],
    ) -> ChatMessage | None:
        if intent != "medical":
            return None

        risk_type = _detect_adhd_risk_behavior(message)
        if risk_type is None:
            return None

        logger.warning(
            "adhd_risk_blocked",
            extra={"session_id": session.id, "risk_type": risk_type, "message_preview": message[:50]},
        )
        reply = _append_follow_up_questions(
            _build_adhd_risk_message(risk_type, reminders),
            message=message,
            intent=intent,
            medication_related=_is_medication_related_question(intent=intent, message=message),
            lifestyle_context_available=False,
            risk_type=risk_type,
        )
        await self._save_user_message(session=session, message=message, intent=intent)
        assistant_msg = await ChatMessage.create(
            session_id=session.id,
            role=ChatRole.ASSISTANT,
            status=ChatMessageStatus.COMPLETED,
            content=reply,
            intent_label=intent,
            guardrail_blocked=True,
            guardrail_reason=f"ADHD 위험 행동 감지: {risk_type}",
            prompt_version=CHAT_PROMPT_VERSION,
            model_version=config.OPENAI_CHAT_MODEL,
        )
        await self._update_session_activity(session)
        return assistant_msg

    async def _check_clarification(
        self, *, session: ChatSession, message: str, intent: str, needs_clarification: bool
    ) -> ChatMessage | None:
        """저유사도 재질문 조기 종료. None이면 정상 진행."""
        if not needs_clarification:
            return None
        clarification = (
            "질문을 조금 더 구체적으로 해주세요. "
            "예: 복용 중인 약물명, 증상, 궁금한 점을 함께 알려주시면 더 정확한 답변을 드릴 수 있습니다."
        )
        await self._save_user_message(session=session, message=message, intent=intent)
        assistant_msg = await ChatMessage.create(
            session_id=session.id,
            role=ChatRole.ASSISTANT,
            status=ChatMessageStatus.COMPLETED,
            content=clarification,
            intent_label=intent,
            needs_clarification=True,
            prompt_version=CHAT_PROMPT_VERSION,
            model_version=config.OPENAI_CHAT_MODEL,
        )
        await self._update_session_activity(session)
        return assistant_msg

    async def stream_message(  # noqa: C901
        self, *, user: User, session_id: int, message: str
    ) -> AsyncGenerator[tuple[str, dict[str, Any]]]:
        """REQ-038: 토큰 단위 SSE 스트리밍"""
        session = await self._get_active_session(user=user, session_id=session_id)
        normalized_msg = message.lower().strip()
        intent = (
            "emergency" if any(kw in normalized_msg for kw in _GUARDRAIL_KEYWORDS) else await _classify_intent(message)
        )

        early_msg = await self._check_early_exit(session=session, message=message, intent=intent)
        if early_msg is not None:
            return self._single_token_stream(early_msg.content)

        reminders = await _get_user_medication_reminders(user=user)
        risk_msg = await self._check_adhd_risk_exit(
            session=session,
            message=message,
            intent=intent,
            reminders=reminders,
        )
        if risk_msg is not None:
            return self._single_token_stream(risk_msg.content)

        (
            user_health_profile,
            rag_docs,
            needs_clarification,
            retrieved_doc_ids,
        ) = await self._prepare_rag_context(user=user, intent=intent, message=message)
        medication_related = _is_medication_related_question(intent=intent, message=message)
        medication_ctx = await _prepare_medication_context(
            user=user,
            intent=intent,
            message=message,
            reminders=reminders,
        )
        lifestyle_ctx = _build_lifestyle_context(user_health_profile, intent=intent)

        clarification_msg = await self._check_clarification(
            session=session, message=message, intent=intent, needs_clarification=needs_clarification
        )
        if clarification_msg is not None:
            return self._single_token_stream(clarification_msg.content)

        profile_ctx = _build_profile_context(user_health_profile)
        rag_ctx = _build_rag_context(rag_docs)
        prompt_guidance = ""
        if lifestyle_ctx:
            prompt_guidance += _LIFESTYLE_PROMPT_GUIDANCE
        if medication_ctx:
            prompt_guidance += _MEDICATION_PROMPT_GUIDANCE
        system_content = _SYSTEM_PROMPT_BASE + prompt_guidance + profile_ctx + lifestyle_ctx + medication_ctx + rag_ctx
        recent = await (
            ChatMessage.filter(session_id=session.id, role__in=[ChatRole.USER, ChatRole.ASSISTANT])
            .order_by("-created_at")
            .limit(_MAX_HISTORY_TURNS * 2)
        )
        history = [{"role": m.role.lower(), "content": m.content} for m in reversed(recent)]
        messages_payload = [{"role": "system", "content": system_content}] + history
        messages_payload.append({"role": "user", "content": message})

        await ChatMessage.create(
            session_id=session.id,
            role=ChatRole.USER,
            status=ChatMessageStatus.COMPLETED,
            content=message,
            intent_label=intent,
            prompt_version=CHAT_PROMPT_VERSION,
            model_version=config.OPENAI_CHAT_MODEL,
        )
        assistant_msg = await ChatMessage.create(
            session_id=session.id,
            role=ChatRole.ASSISTANT,
            status=ChatMessageStatus.STREAMING,
            content="",
            intent_label=intent,
            references_json=[],
            retrieved_doc_ids=retrieved_doc_ids,
            prompt_version=CHAT_PROMPT_VERSION,
            model_version=config.OPENAI_CHAT_MODEL,
        )
        await self._update_session_activity(session)

        async def _stream_gen() -> AsyncGenerator[tuple[str, dict[str, Any]]]:
            collected: list[str] = []
            try:
                async for token in stream_chat_completion(model=config.OPENAI_CHAT_MODEL, messages=messages_payload):
                    collected.append(token)
                    yield "token", {"content": token}
                raw_reply = "".join(collected)
                assistant_msg.references_json = await _select_used_references(raw_reply, rag_docs)
                final_reply = _append_follow_up_questions(
                    raw_reply,
                    message=message,
                    intent=intent,
                    medication_related=medication_related,
                    lifestyle_context_available=bool(lifestyle_ctx),
                )
                assistant_msg.content = final_reply
                stripped_reply = raw_reply.rstrip()
                if final_reply != raw_reply and final_reply.startswith(stripped_reply):
                    yield "token", {"content": final_reply[len(stripped_reply) :]}
                assistant_msg.status = ChatMessageStatus.COMPLETED
                if assistant_msg.references_json:
                    yield "reference", {"references": assistant_msg.references_json}
            except Exception:
                logger.exception("stream_chat_completion failed (session_id=%s)", session.id)
                assistant_msg.status = ChatMessageStatus.FAILED
                assistant_msg.content = "".join(collected)
            finally:
                await assistant_msg.save(update_fields=["content", "status", "references_json", "updated_at"])

        return _stream_gen()
