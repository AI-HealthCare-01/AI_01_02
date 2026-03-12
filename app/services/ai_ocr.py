import json
from pathlib import Path
from uuid import uuid4

import httpx
from openai import AsyncOpenAI
from pydantic import ValidationError

from app.core import config, default_logger
from app.dtos.ocr import OcrMedicationItem

client = AsyncOpenAI(api_key=config.OPENAI_API_KEY)


async def call_clova_ocr(file_path: Path) -> dict:
    url = config.CLOVA_OCR_APIGW_URL
    secret = config.CLOVA_OCR_SECRET

    if not url or not secret:
        raise ValueError("CLOVA OCR API URL or Secret is not configured.")

    headers = {
        "X-OCR-SECRET": secret,
    }

    payload = {
        "version": "V2",
        "requestId": str(uuid4()),
        "timestamp": 0,
        "images": [{"format": file_path.suffix.lstrip(".").lower(), "name": file_path.name}],
    }

    files = {"file": file_path.read_bytes()}

    async with httpx.AsyncClient(timeout=30.0) as http_client:
        response = await http_client.post(url, headers=headers, data={"message": json.dumps(payload)}, files=files)

        if response.status_code != 200:
            default_logger.error("CLOVA OCR API error: %s", response.text)
            raise RuntimeError(f"CLOVA OCR failed with status {response.status_code}")

        return response.json()


async def parse_ocr_with_openai(raw_text: str) -> dict:
    if not isinstance(raw_text, str) or not raw_text.strip():
        return {"extracted_medications": [], "needs_user_review": True}

    prompt = f"""
다음은 처방전/약봉투에서 추출한 raw 텍스트입니다.
이 텍스트 속에서 다음 필드들을 추출하여 JSON 객체 형태로 반환해주세요. (키 이름은 반드시 영어로 작성하세요):
- "drug_name": 약물 이름 (문자열, 필수). 절대 성분명이 아닌 '제품명(처방약품명)'을 정확히 추출할 것. (예: sertraline 대신 졸로푸트정100mg)
- "dosage_per_once": 1회 투여량 (소수점 숫자 또는 null). 주의: 밀리그램(mg) 용량이 아님.
- "frequency_per_day": 1일 투여 횟수 (숫자 또는 null). ※특별규칙※: "1 | 14" 처럼 '|' 기호로 두 숫자만 나열된 경우, 보통 '1'회 투여횟수가 생략된 것입니다. 이 경우 frequency_per_day는 무조건 '1'로 설정하세요.
- "total_days": 총 투약 일수 (숫자 또는 null). ※특별규칙※: "1 | 14" 처럼 '|' 기호 뒤에 오는 큰 숫자(14)는 무조건 총 투약일수(total_days)입니다. 절대 frequency_per_day로 혼동하지 마세요. (예: "1 | 14" -> dosage:1, frequency:1, total_days:14). 그 외에 맨 마지막에 나오는 큰 숫자(예: 총투약량 30)를 투약일수로 오해하지 말고, '용법 앞'의 번호를 선택하세요.
- "dispensed_date": 조제일자 또는 처방일자 (문자열, YYYY-MM-DD 형식 또는 null). 텍스트 맨 아래쪽에 "조제년월일 2026-03-01" 처럼 적혀있을 수 있으니 문서 전체를 꼼꼼히 확인하세요. 값의 포맷은 반드시 YYYY-MM-DD (예: 2026-03-01) 형태로 정리하세요.

주의사항: 단 하나의 약물도 누락시키지 말고, 결제/조제기록 등 상관없는 부분이 아니라 실제 처방된 모든 약물 목록을 추출할 것.
반환 결과는 반드시 {{"extracted_medications": [...]}} 형태의 유효한 JSON 객체이어야 하며, 다른 부가적인 설명은 금지합니다.

[추출 대상 텍스트 시작]
{raw_text}
[추출 대상 텍스트 끝]
"""

    system_content = "You are a highly precise medical document data extraction assistant. Output pure JSON only."

    response = await client.chat.completions.create(
        model=config.OPENAI_CHAT_MODEL,
        messages=[
            {"role": "system", "content": system_content},
            {"role": "user", "content": prompt},
        ],
        temperature=0.0,
        response_format={"type": "json_object"},
    )

    content = response.choices[0].message.content
    if not content:
        return {"extracted_medications": [], "needs_user_review": True}

    try:
        parsed_json = json.loads(content)
        # Handle cases where GPT wraps the array in a dict like {"medications": [...]}
        if isinstance(parsed_json, dict) and "medications" in parsed_json:
            parsed_items = parsed_json["medications"]
        elif isinstance(parsed_json, dict) and "extracted_medications" in parsed_json:
            parsed_items = parsed_json["extracted_medications"]
        elif isinstance(parsed_json, list):
            parsed_items = parsed_json
        else:
            parsed_items = []

        valid_meds = []
        for item in parsed_items:
            try:
                valid_meds.append(OcrMedicationItem(**item).model_dump(exclude_none=True))
            except ValidationError as e:
                default_logger.warning("Validation error on parsed item: %s. Error: %s", item, e)
                continue

        return {
            "extracted_medications": valid_meds,
            "needs_user_review": len(valid_meds) == 0,  # Require review if parsing yields nothing
        }

    except json.JSONDecodeError:
        default_logger.error("Failed to decode OpenAI JSON response: %s", content)
        return {"extracted_medications": [], "needs_user_review": True}
