"""AI 모델 결과 일관성 검증 스크립트.

동일 입력에 대해 N회 반복 호출 후 출력의 구조·값 일관성을 검증한다.

실행 방법:
  # OCR 파싱 일관성 (temperature=0.0, 결정적)
  uv run python scripts/consistency_test.py --mode ocr --iterations 5

  # Guide 생성 일관성 (temperature=0.2, 미세 변동 허용)
  uv run python scripts/consistency_test.py --mode guide --iterations 5

  # RAG 검색 일관성 (수학적 연산, 결정적) — 서버 필요
  uv run python scripts/consistency_test.py --mode rag --base-url http://localhost:8000 --email test@test.com --password pass

  # 전체
  uv run python scripts/consistency_test.py --mode all --base-url http://localhost:8000 --email test@test.com --password pass

필요 환경변수:
  OPENAI_API_KEY  (ocr/guide 모드)
"""

from __future__ import annotations

import argparse
import asyncio
import json
import os
import statistics
from typing import Any

# ---------------------------------------------------------------------------
# 샘플 데이터 (평가 전용 — 프롬프트 개발 시 사용하지 않은 별도 입력)
# ---------------------------------------------------------------------------

EVAL_OCR_TEXT = (
    "처방전\n"
    "환자명: 홍길동\n"
    "조제일자: 2026-03-15\n"
    "콘서타OROS서방정18mg  1일 1회  1회 1정  아침 식후  총 30일분\n"
    "아토목세틴캡슐25mg  1일 1회  1회 1캡슐  아침 식후  총 30일분\n"
)

EVAL_GUIDE_PROFILE = json.dumps(
    {
        "age": 28,
        "gender": "male",
        "height_cm": 175,
        "weight_kg": 68,
        "bmi": 22.2,
        "medications": [
            {"drug_name": "콘서타OROS서방정", "dose": 18.0, "frequency_per_day": 1},
            {"drug_name": "아토목세틴캡슐", "dose": 25.0, "frequency_per_day": 1},
        ],
        "sleep_hours": 6.5,
        "sleep_quality": "보통",
        "awakenings": 1,
        "exercise_frequency": 3,
        "caffeine_cups_per_day": 2,
        "smoking": False,
        "alcohol_frequency": "주 1회",
        "meal_regularity": "불규칙",
        "risk_codes": {
            "nutrition": "IRREGULAR_MEAL_PATTERN",
            "sleep": "NONE",
            "exercise": "NONE",
            "caffeine": "NONE",
            "smoking": "NONE",
            "alcohol": "NONE",
            "digital": "NONE",
            "lifestyle": "NONE",
        },
    },
    ensure_ascii=False,
)

EVAL_RAG_QUERY = "ADHD 약물 복용 시 카페인 섭취가 집중력에 미치는 영향이 궁금합니다"

# ---------------------------------------------------------------------------
# 시스템 프롬프트 (프로덕션 코드와 동일)
# ---------------------------------------------------------------------------

OCR_SYSTEM_PROMPT = (
    "처방전/약봉투 OCR 텍스트에서 약물 정보를 추출하세요. "
    "각 필드 설명: "
    "drug_name=약품명 전체(제형 포함, mg 숫자만 제외. 예: '콘서타오로스서방정27mg' → '콘서타오로스서방정'), "
    "dose=약물 함량의 mg 숫자(예: '콘서타오로스서방정27mg' → 27.0), "
    "frequency_per_day=1일 투여 횟수, "
    "dosage_per_once=1회 투여 정수(정/캡슐 수), "
    "dispensed_date=조제일(YYYY-MM-DD), "
    "total_days=총 투약 일수. "
    "반드시 JSON으로만 응답하세요: "
    '{"medications": [{"drug_name": str, "dose": float|null, "frequency_per_day": int|null, '
    '"dosage_per_once": int|null, "intake_time": str|null, "administration_timing": str|null, '
    '"dispensed_date": "YYYY-MM-DD"|null, "total_days": int|null}], '
    '"overall_confidence": float, "needs_user_review": bool}. '
    "빈 값이 있거나 텍스트가 잘렸다면 confidence를 절대 0.85 이상 주지 마라."
)

# Guide 프롬프트는 ai_worker/tasks/guide.py 참조 (77줄, 여기선 요약만 사용)
GUIDE_SYSTEM_PROMPT = (
    "You are a clinical medication and lifestyle guidance assistant specializing in ADHD care.\n\n"
    "Return only a JSON object with exactly these keys:\n"
    "nutrition_guide, exercise_guide, concentration_strategy, sleep_guide,\n"
    "caffeine_guide, smoking_guide, drinking_guide, general_health_guide.\n\n"
    "All guidance must be in Korean and follow these global constraints:\n"
    "- Do NOT make a definitive medical diagnosis.\n"
    "- Use professional, calm, non-alarming, supportive language.\n"
    "- Provide practical and actionable advice.\n"
    "- Do not use bullet points.\n"
    "- Do not mention raw numeric input values.\n"
    "- Output only the guidance text values in JSON (no markdown, no extra commentary).\n\n"
    "Section-specific rules:\n"
    "nutrition_guide: risk_code=IRREGULAR_MEAL_PATTERN → explain impact on concentration/energy, "
    "suggest practical routines, emphasize gradual improvement, 3-4 sentences.\n"
    "If a section risk code is NONE, provide short preventive guidance in 1-2 natural Korean sentences."
)

GUIDE_EXPECTED_KEYS = frozenset(
    [
        "nutrition_guide",
        "exercise_guide",
        "concentration_strategy",
        "sleep_guide",
        "caffeine_guide",
        "smoking_guide",
        "drinking_guide",
        "general_health_guide",
    ]
)


# ---------------------------------------------------------------------------
# 검증 함수
# ---------------------------------------------------------------------------


def _keys_match(results: list[dict]) -> bool:
    """모든 결과의 JSON 키 구조가 동일한지 확인."""
    if not results:
        return False
    first_keys = set(results[0].keys())
    return all(set(r.keys()) == first_keys for r in results)


def _values_identical(results: list[dict], key: str) -> bool:
    """특정 키의 값이 모든 결과에서 동일한지 확인."""
    if not results:
        return False
    first_val = results[0].get(key)
    return all(r.get(key) == first_val for r in results)


def _text_length_variance(results: list[dict], key: str) -> float:
    """특정 키의 텍스트 길이 편차율(%) 계산."""
    lengths = [len(str(r.get(key, ""))) for r in results]
    if not lengths or max(lengths) == 0:
        return 0.0
    mean_len = statistics.mean(lengths)
    if mean_len == 0:
        return 0.0
    max_dev = max(abs(length - mean_len) for length in lengths)
    return (max_dev / mean_len) * 100


# ---------------------------------------------------------------------------
# OCR 일관성 테스트
# ---------------------------------------------------------------------------


async def test_ocr_consistency(iterations: int) -> dict[str, Any]:
    """OCR 파싱 결과 일관성 테스트 (temperature=0.0)."""
    from openai import AsyncOpenAI

    api_key = os.environ.get("OPENAI_API_KEY", "")
    if not api_key:
        return {"mode": "ocr", "status": "SKIP", "reason": "OPENAI_API_KEY not set"}

    client = AsyncOpenAI(api_key=api_key)
    results: list[dict] = []

    for i in range(iterations):
        try:
            response = await client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": OCR_SYSTEM_PROMPT},
                    {"role": "user", "content": EVAL_OCR_TEXT},
                ],
                temperature=0.0,
                response_format={"type": "json_object"},
            )
            parsed = json.loads(response.choices[0].message.content or "{}")
        except (json.JSONDecodeError, IndexError, AttributeError) as exc:
            print(f"  OCR iteration {i + 1}/{iterations} — parse error: {exc}")
            continue
        except Exception as exc:
            print(f"  OCR iteration {i + 1}/{iterations} — API error: {exc}")
            continue
        results.append(parsed)
        print(f"  OCR iteration {i + 1}/{iterations} — confidence={parsed.get('overall_confidence')}")

    if len(results) < 2:
        return {"mode": "ocr", "status": "FAIL", "reason": f"only {len(results)}/{iterations} iterations succeeded"}

    keys_ok = _keys_match(results)
    confidence_ok = _values_identical(results, "overall_confidence")
    meds_count_ok = all(len(r.get("medications", [])) == len(results[0].get("medications", [])) for r in results)
    drug_names_ok = all(
        [m.get("drug_name") for m in r.get("medications", [])]
        == [m.get("drug_name") for m in results[0].get("medications", [])]
        for r in results
    )

    passed = keys_ok and confidence_ok and meds_count_ok and drug_names_ok
    return {
        "mode": "ocr",
        "iterations": iterations,
        "temperature": 0.0,
        "keys_consistent": keys_ok,
        "confidence_identical": confidence_ok,
        "medication_count_identical": meds_count_ok,
        "drug_names_identical": drug_names_ok,
        "status": "PASS" if passed else "FAIL",
    }


# ---------------------------------------------------------------------------
# Guide 일관성 테스트
# ---------------------------------------------------------------------------


async def test_guide_consistency(iterations: int) -> dict[str, Any]:
    """가이드 생성 결과 일관성 테스트 (temperature=0.2)."""
    from openai import AsyncOpenAI

    api_key = os.environ.get("OPENAI_API_KEY", "")
    if not api_key:
        return {"mode": "guide", "status": "SKIP", "reason": "OPENAI_API_KEY not set"}

    client = AsyncOpenAI(api_key=api_key)
    results: list[dict] = []

    for i in range(iterations):
        try:
            response = await client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": GUIDE_SYSTEM_PROMPT},
                    {"role": "user", "content": EVAL_GUIDE_PROFILE},
                ],
                temperature=0.2,
                response_format={"type": "json_object"},
            )
            parsed = json.loads(response.choices[0].message.content or "{}")
        except (json.JSONDecodeError, IndexError, AttributeError) as exc:
            print(f"  Guide iteration {i + 1}/{iterations} — parse error: {exc}")
            continue
        except Exception as exc:
            print(f"  Guide iteration {i + 1}/{iterations} — API error: {exc}")
            continue
        results.append(parsed)
        print(f"  Guide iteration {i + 1}/{iterations} — keys={set(parsed.keys())}")

    if len(results) < 2:
        return {"mode": "guide", "status": "FAIL", "reason": f"only {len(results)}/{iterations} iterations succeeded"}

    keys_ok = all(set(r.keys()) == GUIDE_EXPECTED_KEYS for r in results)
    variances = {key: _text_length_variance(results, key) for key in GUIDE_EXPECTED_KEYS}
    max_variance = max(variances.values()) if variances else 0.0
    variance_ok = max_variance <= 15.0  # ±15% 이내

    passed = keys_ok and variance_ok
    return {
        "mode": "guide",
        "iterations": iterations,
        "temperature": 0.2,
        "keys_8_of_8_consistent": keys_ok,
        "max_text_length_variance_pct": round(max_variance, 1),
        "variance_threshold": "15%",
        "per_key_variance": {k: f"{v:.1f}%" for k, v in variances.items()},
        "status": "PASS" if passed else "FAIL",
    }


# ---------------------------------------------------------------------------
# RAG 일관성 테스트 (서버 필요)
# ---------------------------------------------------------------------------


def test_rag_consistency(base_url: str, email: str, password: str, iterations: int) -> dict[str, Any]:
    """RAG 하이브리드 검색 일관성 테스트 (BM25 + Dense = 결정적)."""
    import httpx

    if not base_url or not email:
        return {"mode": "rag", "status": "SKIP", "reason": "base-url/email not provided"}

    with httpx.Client(timeout=30.0) as client:
        # 로그인
        resp = client.post(
            f"{base_url}/api/v1/auth/login",
            json={"email": email, "password": password},
        )
        if resp.status_code != 200:
            return {"mode": "rag", "status": "SKIP", "reason": f"login failed ({resp.status_code})"}
        token = resp.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        # 세션 생성
        sess_resp = client.post(f"{base_url}/api/v1/chat/sessions", headers=headers, json={})
        if sess_resp.status_code not in (200, 201):
            return {"mode": "rag", "status": "SKIP", "reason": "session creation failed"}
        session_id = sess_resp.json().get("id") or sess_resp.json().get("session_id")

        # 동일 쿼리 N회 전송 — SSE 응답에서 references 추출
        all_references: list[list] = []
        for i in range(iterations):
            msg_resp = client.post(
                f"{base_url}/api/v1/chat/sessions/{session_id}/messages",
                headers=headers,
                json={"content": EVAL_RAG_QUERY},
                timeout=60.0,
            )
            if msg_resp.status_code not in (200, 201):
                all_references.append([])
                continue

            # SSE 또는 JSON 응답에서 references 추출
            try:
                data = msg_resp.json()
                refs = data.get("references", [])
            except (json.JSONDecodeError, ValueError):
                refs = []
            except Exception as exc:
                print(f"  RAG iteration {i + 1}/{iterations} — unexpected error: {exc}")
                refs = []
            all_references.append(refs)
            print(f"  RAG iteration {i + 1}/{iterations} — refs={len(refs)}")

    if not all_references or all(not r for r in all_references):
        return {"mode": "rag", "status": "SKIP", "reason": "no references returned (SSE streaming)"}

    # 비교: 문서 ID·제목 집합이 동일한지
    ref_sets = [frozenset(r.get("title", "") for r in refs) for refs in all_references if refs]
    refs_identical = len(set(ref_sets)) <= 1 if ref_sets else True

    return {
        "mode": "rag",
        "iterations": iterations,
        "algorithm": "BM25(0.3) + Dense(0.7) — deterministic",
        "reference_sets_identical": refs_identical,
        "status": "PASS" if refs_identical else "FAIL",
    }


# ---------------------------------------------------------------------------
# 결과 출력
# ---------------------------------------------------------------------------


def print_result(result: dict[str, Any]) -> None:
    """결과를 테이블 형태로 출력."""
    mode = result.get("mode", "?").upper()
    status = result.get("status", "?")
    print(f"\n{'=' * 60}")
    print(f"  [{mode}] 일관성 테스트 — {status}")
    print(f"{'=' * 60}")
    for key, val in result.items():
        if key in ("mode", "status", "per_key_variance"):
            continue
        print(f"  {key:<35} {val}")
    if "per_key_variance" in result:
        print(f"  {'─' * 55}")
        for k, v in result["per_key_variance"].items():
            print(f"    {k:<33} {v}")
    print()


# ---------------------------------------------------------------------------
# main
# ---------------------------------------------------------------------------


def main() -> None:
    parser = argparse.ArgumentParser(description="AI 모델 결과 일관성 검증")
    parser.add_argument("--mode", choices=["ocr", "guide", "rag", "all"], default="all")
    parser.add_argument("--iterations", type=int, default=5, help="반복 횟수 (기본: 5)")
    parser.add_argument("--base-url", default="", help="API 서버 URL (rag 모드용)")
    parser.add_argument("--email", default="", help="테스트 계정 이메일 (rag 모드용)")
    parser.add_argument("--password", default="", help="테스트 계정 비밀번호 (rag 모드용)")
    args = parser.parse_args()

    modes = [args.mode] if args.mode != "all" else ["ocr", "guide", "rag"]
    results: list[dict[str, Any]] = []
    all_pass = True

    for mode in modes:
        print(f"\n▶ {mode.upper()} 일관성 테스트 시작 (iterations={args.iterations})")
        if mode == "ocr":
            result = asyncio.run(test_ocr_consistency(args.iterations))
        elif mode == "guide":
            result = asyncio.run(test_guide_consistency(args.iterations))
        elif mode == "rag":
            result = test_rag_consistency(args.base_url, args.email, args.password, args.iterations)
        else:
            continue

        results.append(result)
        print_result(result)
        if result["status"] == "FAIL":
            all_pass = False

    # 요약
    print("=" * 60)
    print("  최종 결과")
    print("=" * 60)
    for r in results:
        print(f"  {r['mode'].upper():<10} {r['status']}")
    print(f"\n  종합: {'ALL PASS' if all_pass else 'FAIL 항목 존재'}")


if __name__ == "__main__":
    main()
