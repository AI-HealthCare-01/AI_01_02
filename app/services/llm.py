import json
from collections.abc import AsyncGenerator

from openai import APITimeoutError, AsyncOpenAI

from app.core import config
from app.core.exceptions import AppException, ErrorCode
from app.core.logger import default_logger as logger

_LLM_TIMEOUT_SECONDS = 30.0

_client: AsyncOpenAI | None = None


def get_openai_client() -> AsyncOpenAI:
    global _client
    if _client is None:
        _client = AsyncOpenAI(api_key=config.OPENAI_API_KEY, timeout=_LLM_TIMEOUT_SECONDS)
    return _client


async def chat_completion(*, model: str, messages: list[dict], temperature: float = 0.7) -> str:
    client = get_openai_client()
    try:
        response = await client.chat.completions.create(
            model=model,
            messages=messages,  # type: ignore[arg-type]
            temperature=temperature,
        )
    except APITimeoutError:
        logger.warning("openai chat_completion timeout (model=%s)", model)
        raise AppException(ErrorCode.EXTERNAL_SERVICE_TIMEOUT, developer_message="OpenAI API timeout") from None
    return response.choices[0].message.content or ""


async def stream_chat_completion(*, model: str, messages: list[dict], temperature: float = 0.7) -> AsyncGenerator[str]:
    """토큰 단위 스트리밍 (REQ-038)"""
    client = get_openai_client()
    try:
        stream = await client.chat.completions.create(
            model=model,
            messages=messages,  # type: ignore[arg-type]
            temperature=temperature,
            stream=True,
        )  # type: ignore[call-overload]
    except APITimeoutError:
        logger.warning("openai stream_chat_completion timeout (model=%s)", model)
        raise AppException(ErrorCode.EXTERNAL_SERVICE_TIMEOUT, developer_message="OpenAI API timeout") from None
    async for chunk in stream:  # type: ignore[union-attr]
        token = chunk.choices[0].delta.content
        if token:
            yield token


async def json_completion(*, model: str, messages: list[dict], temperature: float = 0.3) -> dict:
    """JSON 스키마 강제 응답 (REQ-048)"""
    from openai.types.shared_params import ResponseFormatJSONObject  # noqa: PLC0415

    client = get_openai_client()
    try:
        response = await client.chat.completions.create(
            model=model,
            messages=messages,  # type: ignore[arg-type]
            temperature=temperature,
            response_format=ResponseFormatJSONObject(type="json_object"),
        )
    except APITimeoutError:
        logger.warning("openai json_completion timeout (model=%s)", model)
        raise AppException(ErrorCode.EXTERNAL_SERVICE_TIMEOUT, developer_message="OpenAI API timeout") from None
    raw = response.choices[0].message.content or "{}"
    return json.loads(raw)
