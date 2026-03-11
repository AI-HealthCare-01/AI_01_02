import asyncio
import json
from openai import AsyncOpenAI
from ai_worker.core import config
from ai_worker.tasks.ocr import _PARSE_SYSTEM_PROMPT

async def main():
    client = AsyncOpenAI(api_key=config.OPENAI_API_KEY)
    text = """
    처방전
    환자명: 홍길동
    약품명: 로라반정
    1회 투약량: 1, 1일 투여횟수: 1, 총 투약일수: 28
    
    약품명: 스틸녹스CR정
    1회 투약량: 1, 1일 투여횟수: 1, 총 투약일수: 7
    (용법 옆에 작게 '취침전'이라고 써있고, 다른곳에 연하게 '아침 식후 30분' 라고 써있음)
    """
    response = await client.chat.completions.create(
        model=config.OPENAI_CHAT_MODEL,
        messages=[
            {"role": "system", "content": _PARSE_SYSTEM_PROMPT},
            {"role": "user", "content": text},
        ],
        temperature=0.0,
        response_format={"type": "json_object"},
    )
    print("Response JSON:")
    print(response.choices[0].message.content)

asyncio.run(main())
