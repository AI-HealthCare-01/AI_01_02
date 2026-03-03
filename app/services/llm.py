import json
from collections.abc import AsyncGenerator

from openai import AsyncOpenAI

from app.core import config

_client: AsyncOpenAI | None = None


def get_openai_client() -> AsyncOpenAI:
    global _client
    if _client is None:
        _client = AsyncOpenAI(api_key=config.OPENAI_API_KEY)
    return _client


async def chat_completion(*, model: str, messages: list[dict], temperature: float = 0.7) -> str:
    client = get_openai_client()
    response = await client.chat.completions.create(
        model=model,
        messages=messages,  # type: ignore[arg-type]
        temperature=temperature,
    )
    return response.choices[0].message.content or ""


async def stream_chat_completion(*, model: str, messages: list[dict], temperature: float = 0.7) -> AsyncGenerator[str]:
    """토큰 단위 스트리밍 (REQ-038)"""
    client = get_openai_client()
    stream = await client.chat.completions.create(
        model=model,
        messages=messages,  # type: ignore[arg-type]
        temperature=temperature,
        stream=True,
    )  # type: ignore[call-overload]
    async for chunk in stream:  # type: ignore[union-attr]
        token = chunk.choices[0].delta.content
        if token:
            yield token


async def json_completion(*, model: str, messages: list[dict], temperature: float = 0.3) -> dict:
    """JSON 스키마 강제 응답 (REQ-048)"""
    from openai.types.shared_params import ResponseFormatJSONObject  # noqa: PLC0415

    client = get_openai_client()
    response = await client.chat.completions.create(
        model=model,
        messages=messages,  # type: ignore[arg-type]
        temperature=temperature,
        response_format=ResponseFormatJSONObject(type="json_object"),
    )
    raw = response.choices[0].message.content or "{}"
    return json.loads(raw)
