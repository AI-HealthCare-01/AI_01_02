import asyncio
from collections.abc import AsyncGenerator
from datetime import datetime, timedelta

from app.core import config
from app.core.exceptions import AppException, ErrorCode
from app.core.logger import default_logger as logger
from app.models.chat import ChatMessage, ChatMessageStatus, ChatRole, ChatSession, ChatSessionStatus
from app.models.profiles import HealthProfile
from app.models.users import User
from app.services.llm import chat_completion, json_completion, stream_chat_completion
from app.services.rag import hybrid_search

# REQ-049: 프롬프트 버전 관리
CHAT_PROMPT_VERSION = "v1.2"

_GUARDRAIL_KEYWORDS = frozenset(["자살", "자해", "죽고 싶", "죽이고", "약물 오남용", "마약", "범죄"])
_EMERGENCY_MESSAGE = (
    "위기 상황이 감지되었습니다. 즉시 정신건강 위기상담 전화 1577-0199 또는 자살예방상담전화 1393으로 연락하세요."
)

# REQ-049: 시스템 프롬프트 버전 관리
_SYSTEM_PROMPT_BASE = (
    "당신은 ADHD 환자를 위한 건강 관리 AI 어시스턴트입니다. "
    "복약, 생활습관, 수면, 영양에 관한 질문에 답변합니다. "
    "의학적 진단이나 처방은 제공하지 않으며, 항상 의료진 상담을 권장합니다. "
    "제공된 근거 문서에 기반해서만 답변하고, 근거가 없으면 모른다고 답변합니다."
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


def _build_profile_context(profile: HealthProfile | None) -> str:
    """REQ-032: 사용자 프로필/약 정보를 시스템 프롬프트에 주입"""
    if not profile:
        return ""
    parts = []
    basic = profile.basic_info
    if basic.get("height_cm") and basic.get("weight_kg"):
        parts.append(f"키 {basic['height_cm']}cm, 체중 {basic['weight_kg']}kg")
    if basic.get("drug_allergies"):
        parts.append(f"약물 알러지: {', '.join(basic['drug_allergies'])}")
    if not parts:
        return ""
    return "\n\n[사용자 건강 정보]\n" + "\n".join(parts)


def _build_rag_context(rag_docs: list) -> str:
    """REQ-036: 검색된 근거 문서를 프롬프트 컨텍스트로 변환"""
    if not rag_docs:
        return ""
    parts = ["\n\n[참고 의학 문서]"]
    for i, doc in enumerate(rag_docs, 1):
        parts.append(f"{i}. [{doc.title}] {doc.content}")
    return "\n".join(parts)


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
    ) -> tuple[HealthProfile | None, list, bool, list[str]]:
        """프로필 조회 + RAG 검색을 동시 실행."""
        profile_task = HealthProfile.get_or_none(user_id=user.id)

        rag_docs: list = []
        needs_clarification = False
        retrieved_doc_ids: list[str] = []

        if intent == "medical":
            try:
                profile, (rag_docs, needs_clarification) = await asyncio.gather(profile_task, hybrid_search(message))
                retrieved_doc_ids = [d.doc_id for d in rag_docs]
                needs_clarification = False
                return profile, rag_docs, needs_clarification, retrieved_doc_ids
            except Exception:
                logger.warning("RAG hybrid_search failed (user_id=%s)", user.id, exc_info=True)

        profile = await profile_task
        return profile, rag_docs, needs_clarification, retrieved_doc_ids

    async def send_message(self, *, user: User, session_id: int, message: str) -> ChatMessage:
        session = await self._get_active_session(user=user, session_id=session_id)
        intent = "emergency" if any(kw in message for kw in _GUARDRAIL_KEYWORDS) else await _classify_intent(message)

        # REQ-035: 안전 가드레일 — emergency 차단
        early = await self._check_early_exit(session=session, message=message, intent=intent)
        if early is not None:
            async for _ in early:
                pass
            last_msg = (
                await ChatMessage.filter(session_id=session.id, role=ChatRole.ASSISTANT).order_by("-created_at").first()
            )
            return last_msg  # type: ignore[return-value]

        profile, rag_docs, needs_clarification, retrieved_doc_ids = await self._prepare_rag_context(
            user=user, intent=intent, message=message
        )

        # REQ-042: 저유사도 재질문 유도
        clarification_gen = await self._check_clarification(
            session=session, message=message, intent=intent, needs_clarification=needs_clarification
        )
        if clarification_gen is not None:
            async for _ in clarification_gen:
                pass
            last_msg = (
                await ChatMessage.filter(session_id=session.id, role=ChatRole.ASSISTANT).order_by("-created_at").first()
            )
            return last_msg  # type: ignore[return-value]

        # REQ-036: RAG 컨텍스트 + 프로필 컨텍스트로 시스템 프롬프트 구성
        profile_ctx = _build_profile_context(profile)
        rag_ctx = _build_rag_context(rag_docs)
        system_content = _SYSTEM_PROMPT_BASE + profile_ctx + rag_ctx

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

        # 최근 대화 이력 조회
        recent = await (
            ChatMessage.filter(session_id=session.id, role__in=[ChatRole.USER, ChatRole.ASSISTANT])
            .order_by("-created_at")
            .limit(_MAX_HISTORY_TURNS * 2)
        )
        history = [{"role": m.role.lower(), "content": m.content} for m in reversed(recent)]
        messages_payload = [{"role": "system", "content": system_content}] + history

        references_json = [d.to_reference_dict() for d in rag_docs]

        assistant_msg = await ChatMessage.create(
            session_id=session.id,
            role=ChatRole.ASSISTANT,
            status=ChatMessageStatus.COMPLETED,
            content="",
            intent_label=intent,
            references_json=references_json,
            retrieved_doc_ids=retrieved_doc_ids,
            prompt_version=CHAT_PROMPT_VERSION,
            model_version=config.OPENAI_CHAT_MODEL,
        )

        try:
            reply = await chat_completion(model=config.OPENAI_CHAT_MODEL, messages=messages_payload)
            assistant_msg.content = reply
            assistant_msg.status = ChatMessageStatus.COMPLETED
        except Exception:
            assistant_msg.status = ChatMessageStatus.FAILED
            await assistant_msg.save(update_fields=["content", "status", "updated_at"])
            logger.exception("chat_completion failed (session_id=%s)", session.id)
            raise AppException(ErrorCode.INTERNAL_ERROR) from None

        await assistant_msg.save(update_fields=["content", "status", "updated_at"])
        await self._update_session_activity(session)
        return assistant_msg

    async def _update_session_activity(self, session: ChatSession) -> None:
        session.last_activity_at = datetime.now(config.TIMEZONE)
        await session.save(update_fields=["last_activity_at", "updated_at"])

    async def _check_early_exit(self, *, session: ChatSession, message: str, intent: str) -> AsyncGenerator[str] | None:
        """가드레일/재질문 조기 종료. None이면 정상 진행."""
        if intent == "emergency":
            logger.warning(
                "guardrail_blocked",
                extra={"session_id": session.id, "message_preview": message[:50]},
            )
            await ChatMessage.create(
                session_id=session.id,
                role=ChatRole.USER,
                status=ChatMessageStatus.COMPLETED,
                content=message,
                intent_label=intent,
                prompt_version=CHAT_PROMPT_VERSION,
                model_version=config.OPENAI_CHAT_MODEL,
            )
            await ChatMessage.create(
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

            async def _emergency_gen() -> AsyncGenerator[str]:
                yield _EMERGENCY_MESSAGE

            return _emergency_gen()
        return None

    async def _check_clarification(
        self, *, session: ChatSession, message: str, intent: str, needs_clarification: bool
    ) -> AsyncGenerator[str] | None:
        """저유사도 재질문 조기 종료. None이면 정상 진행."""
        if not needs_clarification:
            return None
        clarification = (
            "질문을 조금 더 구체적으로 해주세요. "
            "예: 복용 중인 약물명, 증상, 궁금한 점을 함께 알려주시면 더 정확한 답변을 드릴 수 있습니다."
        )
        await ChatMessage.create(
            session_id=session.id,
            role=ChatRole.USER,
            status=ChatMessageStatus.COMPLETED,
            content=message,
            intent_label=intent,
            prompt_version=CHAT_PROMPT_VERSION,
            model_version=config.OPENAI_CHAT_MODEL,
        )
        await ChatMessage.create(
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

        async def _clarification_gen() -> AsyncGenerator[str]:
            yield clarification

        return _clarification_gen()

    async def stream_message(
        self, *, user: User, session_id: int, message: str
    ) -> tuple[list[dict], AsyncGenerator[str]]:
        """REQ-038: 토큰 단위 SSE 스트리밍"""
        session = await self._get_active_session(user=user, session_id=session_id)
        intent = "emergency" if any(kw in message for kw in _GUARDRAIL_KEYWORDS) else await _classify_intent(message)

        early = await self._check_early_exit(session=session, message=message, intent=intent)
        if early is not None:
            return [], early

        profile, rag_docs, needs_clarification, retrieved_doc_ids = await self._prepare_rag_context(
            user=user, intent=intent, message=message
        )

        clarification_gen = await self._check_clarification(
            session=session, message=message, intent=intent, needs_clarification=needs_clarification
        )
        if clarification_gen is not None:
            return [], clarification_gen

        profile_ctx = _build_profile_context(profile)
        rag_ctx = _build_rag_context(rag_docs)
        system_content = _SYSTEM_PROMPT_BASE + profile_ctx + rag_ctx
        recent = await (
            ChatMessage.filter(session_id=session.id, role__in=[ChatRole.USER, ChatRole.ASSISTANT])
            .order_by("-created_at")
            .limit(_MAX_HISTORY_TURNS * 2)
        )
        history = [{"role": m.role.lower(), "content": m.content} for m in reversed(recent)]
        messages_payload = [{"role": "system", "content": system_content}] + history
        messages_payload.append({"role": "user", "content": message})
        references_json = [d.to_reference_dict() for d in rag_docs]

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
            references_json=references_json,
            retrieved_doc_ids=retrieved_doc_ids,
            prompt_version=CHAT_PROMPT_VERSION,
            model_version=config.OPENAI_CHAT_MODEL,
        )
        await self._update_session_activity(session)

        async def _stream_gen() -> AsyncGenerator[str]:
            collected: list[str] = []
            try:
                async for token in stream_chat_completion(model=config.OPENAI_CHAT_MODEL, messages=messages_payload):
                    collected.append(token)
                    yield token
                assistant_msg.content = "".join(collected)
                assistant_msg.status = ChatMessageStatus.COMPLETED
            except Exception:
                assistant_msg.status = ChatMessageStatus.FAILED
                assistant_msg.content = "".join(collected)
            finally:
                await assistant_msg.save(update_fields=["content", "status", "updated_at"])

        return references_json, _stream_gen()
