# AI 모델 성능 평가 보고서

문서 목적: AI 모델(OCR 파싱, RAG 검색, 가이드 생성)의 성능 지표, 실험 비교, 결과 일관성 검증을 정리한다.

## 1. 평가 대상

| 모델 | 용도 | 엔진 | 코드 위치 |
|------|------|------|-----------|
| OCR 텍스트 파싱 | 처방전 → 구조화 JSON | Clova OCR + OpenAI gpt-4o-mini | `ai_worker/tasks/ocr.py` |
| RAG 하이브리드 검색 | 챗봇 질의 → 관련 문서 검색 | text-embedding-3-small + BM25 | `app/services/rag.py` |
| 개인화 가이드 생성 | 건강 프로필 → 맞춤 가이드 | OpenAI gpt-4o-mini | `ai_worker/tasks/guide.py` |

## 2. 성능 지표

### 지표 1: OCR 파싱 신뢰도 (`overall_confidence`)

- **정의**: OCR 텍스트에서 약물 정보를 파싱한 결과의 정확도 (0.0 ~ 1.0)
- **계산 방법** (`ai_worker/tasks/ocr.py:100-117`):
  1. LLM이 초기 confidence 산출
  2. 후처리 검증으로 강제 감점:
     - 필수 필드(`total_days`, `dispensed_date`, `dose`) 누락 → `confidence × 0.7`
     - 용법 텍스트(`intake_time` + `administration_timing`) 2글자 이하 → `confidence × 0.7`
  3. 프롬프트 규칙: *"빈 값이 있거나 텍스트가 잘렸다면 confidence를 절대 0.85 이상 주지 마라"*
- **임계값**: `< 0.85` → `needs_user_review = true` → 사용자 검수 단계 전환
- **결과 저장**: `OcrJob.structured_result` JSON 필드

### 지표 2: RAG 검색 유사도 (`hybrid_score`)

- **정의**: 사용자 질문과 지식 문서 간의 관련성 점수 (0.0 ~ 1.0)
- **계산 방법** (`app/services/rag.py`):
  - BM25 키워드 점수 (가중치 0.3) + Dense 벡터 유사도 (가중치 0.7)
  - `final_score = bm25_weight × bm25_normalized + dense_weight × dense_normalized`
- **설정값**:
  - `RAG_SIMILARITY_THRESHOLD = 0.4` — 임계값 미만 시 재질문 유도
  - `RAG_TOP_K = 5` — 상위 5개 문서 검색
  - `RAG_BM25_WEIGHT = 0.3` / Dense 가중치 0.7
- **결과 저장**: 챗봇 응답에 `references[]` 배열로 문서 출처·점수 포함

## 2.5 평가 데이터셋 및 분리 전략

본 프로젝트는 자체 모델을 학습하지 않고 **외부 LLM API**(OpenAI gpt-4o-mini)를 활용하므로, 전통적인 Train/Test 데이터 분리 대신 **프롬프트 개발용 데이터와 평가용 데이터를 분리**하여 성능을 검증한다.

### 분리 구조

| 구분 | 용도 | 데이터 수 | 설명 |
|------|------|-----------|------|
| **개발 데이터셋** | 프롬프트 튜닝·디버깅 | 10+ | 프롬프트 반복 수정 시 사용한 처방전/프로필 (과적합 가능) |
| **평가 데이터셋** | 최종 성능 측정 전용 | 5+5 | 프롬프트 개발 과정에서 사용하지 않은 별도 입력 |

### 평가 데이터셋 목록

**OCR 파싱 평가 (EVAL-OCR)**:

| ID | 입력 설명 | 특성 |
|----|-----------|------|
| EVAL-OCR-001 | 콘서타 + 아토목세틴 2종 처방전 | 표준 ADHD 복합 처방 |
| EVAL-OCR-002 | 메틸페니데이트 단독 처방전 | 단일 약물, 필드 완전 |
| EVAL-OCR-003 | 일부 필드 누락된 처방전 | 감점 로직 검증용 |
| EVAL-OCR-004 | 용법 텍스트 2글자 이하 처방전 | 텍스트 품질 감점 검증 |
| EVAL-OCR-005 | 3종 이상 약물 처방전 | 다중 약물 파싱 정확도 |

**가이드 생성 평가 (EVAL-GUIDE)**:

| ID | 프로필 설명 | 위험도 코드 |
|----|-------------|------------|
| EVAL-GUIDE-001 | 28세 남성, 불규칙 식사 | IRREGULAR_MEAL_PATTERN |
| EVAL-GUIDE-002 | 35세 여성, 수면 부족 | SLEEP_HIGH_RISK |
| EVAL-GUIDE-003 | 22세 남성, 카페인 과다 | CAFFEINE_HIGH_RISK |
| EVAL-GUIDE-004 | 40세 남성, 전 항목 정상 | 전체 NONE |
| EVAL-GUIDE-005 | 30세 여성, 저체중+불규칙 식사 | UNDERWEIGHT_BORDERLINE + IRREGULAR_MEAL_PATTERN |

**검증 스크립트**: `scripts/consistency_test.py` — 평가 데이터셋으로 반복 테스트 자동화

---

## 3. 실험 비교: 프롬프트 버전별 출력 품질

### 3-1. OCR 파싱 프롬프트 이력

| 버전 | 변경 내용 | 결과 |
|------|-----------|------|
| v1.0 | 기본 JSON 추출 프롬프트 | JSON 구조 불안정, 키 누락 빈번, 신뢰도 미산출 |
| v1.1 | `response_format={"type":"json_object"}` 강제 | 구조 안정화 (키 누락 0%), 신뢰도 산출 로직 추가 |
| **v1.2 (현재)** | 감점 규칙(필수 필드 ×0.7) + 임계값 0.85 + 프롬프트 제약 강화 | 사용자 검수 전환율 적정화, 오탐(불필요한 검수) 30% 감소 |

**정량 비교 — 평가 데이터셋 기준**:

| 평가 샘플 | v1.0 confidence | v1.1 confidence | v1.2 confidence | v1.0 키 누락 | v1.2 키 누락 |
|-----------|-----------------|-----------------|-----------------|-------------|-------------|
| EVAL-OCR-001 | — (미산출) | 0.92 | 0.92 | 2건 | 0건 |
| EVAL-OCR-002 | — | 0.95 | 0.95 | 1건 | 0건 |
| EVAL-OCR-003 | — | 0.88 | 0.62 (감점 적용) | 3건 | 0건 |
| EVAL-OCR-004 | — | 0.90 | 0.63 (용법 감점) | 1건 | 0건 |
| EVAL-OCR-005 | — | 0.85 | 0.85 | 4건 | 0건 |

**비교 분석**:
- v1.0 → v1.1: `response_format` 도입으로 **구조 오류 100% 해소**, 신뢰도 산출 로직 추가
- v1.1 → v1.2: 후처리 감점 로직으로 **과신 방지** — EVAL-OCR-003/004에서 필드 누락·용법 부족 시 confidence 강제 감점 (0.88→0.62, 0.90→0.63)

### 3-2. 가이드 생성 프롬프트 이력 (`GUIDE_PROMPT_VERSION`)

| 버전 | 변경 내용 | 결과 |
|------|-----------|------|
| v1.0 | 8개 가이드 키 정의 (nutrition, exercise, concentration, sleep, caffeine, smoking, drinking, general) | 기본 구조 확립, 가이드 방향성 일관 |
| v1.1 | 위험도 코드별 분기 추가 (HIGH_RISK / BORDERLINE / LOW) | 동일 위험도 → 유사 가이드 내용 보장, 개인화 수준 향상 |
| **v1.2 (현재)** | 문장 수 제한("2-4 sentences" 등) + 금지 규칙("no markdown", "no diagnosis") 세분화 | 출력 일관성 향상, 의료 면책 문구 강화, 텍스트 길이 편차 최소화 |

**정량 비교 — 평가 데이터셋 기준**:

| 평가 샘플 | v1.0 키 일관성 | v1.1 키 일관성 | v1.2 키 일관성 | v1.2 텍스트 길이 편차 |
|-----------|---------------|---------------|---------------|---------------------|
| EVAL-GUIDE-001 | 8/8 | 8/8 | 8/8 | ±6% |
| EVAL-GUIDE-002 | 7/8 (sleep 키 변동) | 8/8 | 8/8 | ±5% |
| EVAL-GUIDE-003 | 8/8 | 8/8 | 8/8 | ±7% |
| EVAL-GUIDE-004 | 8/8 | 8/8 | 8/8 | ±4% |
| EVAL-GUIDE-005 | 7/8 | 8/8 | 8/8 | ±8% |

**비교 분석**:
- v1.0 → v1.1: 위험도 코드 분기로 **동일 입력 → 동일 가이드 방향** 보장 (키 일관성 100%)
- v1.1 → v1.2: 문장 수 제한으로 **텍스트 길이 편차 ±8% 이내** 달성

## 4. 결과 편차 최소화 검증

### 4-1. OCR 파싱 일관성 (temperature=0.0)

| 테스트 | 방법 | 결과 |
|--------|------|------|
| 구조 일관성 | 동일 OCR 텍스트 5회 반복 파싱 | JSON 키 구조 100% 동일 |
| 신뢰도 일관성 | 동일 입력 → confidence 값 비교 | 5회 모두 동일한 값 (결정적 출력) |
| 약물 정보 일관성 | drug_name, dose, frequency 비교 | 5회 모두 동일 |

- `temperature=0.0` → OpenAI API의 결정적(deterministic) 모드
- `response_format={"type":"json_object"}` → 구조 변동 원천 차단

### 4-2. 가이드 생성 일관성 (temperature=0.2)

| 테스트 | 방법 | 결과 |
|--------|------|------|
| 구조 일관성 | 동일 건강 프로필 5회 반복 생성 | 8개 키 구조 100% 동일 |
| 텍스트 길이 | 각 가이드 섹션 글자 수 비교 | 편차 ±8% 이내 |
| 의미적 일관성 | 동일 위험도 코드 → 가이드 핵심 메시지 비교 | 동일 방향성 (표현만 미세 차이) |

- `temperature=0.2` → 자연스러운 한국어 표현을 위한 최소 창의성 허용
- 위험도 코드별 분기(77줄 시스템 프롬프트) → **규칙 기반 결정적 라우팅**
- 문장 수 제한 → 분량 일관성 보장

### 4-3. RAG 검색 일관성 (결정적)

| 테스트 | 방법 | 결과 |
|--------|------|------|
| 검색 결과 | 동일 쿼리 5회 반복 | 동일 문서 집합 + 동일 점수 (100%) |
| 임계값 판단 | needs_clarification 플래그 비교 | 5회 모두 동일 |

- BM25 + Dense 하이브리드 점수 = 수학적 연산 → **완전 결정적**

### 4-4. 편차 최소화 전략 요약

| 전략 | 적용 대상 | 효과 |
|------|-----------|------|
| `response_format={"type":"json_object"}` | OCR, Guide | 구조 변동 원천 차단 |
| `temperature=0.0` | OCR 파싱 | 완전 결정적 출력 |
| `temperature=0.2` | Guide 생성 | 미세 표현 차이만 허용 |
| 위험도 코드별 분기 | Guide 생성 | 동일 조건 → 동일 가이드 방향 |
| 문장 수 제한 | Guide 생성 | 분량 일관성 ±8% 이내 |
| BM25 + Dense 수학 연산 | RAG 검색 | 100% 결정적 |

### 4-5. 자동화 검증 스크립트

위 일관성 테스트를 자동화한 스크립트:

```bash
# OCR 파싱 일관성 (temperature=0.0)
uv run python scripts/consistency_test.py --mode ocr --iterations 5

# Guide 생성 일관성 (temperature=0.2)
uv run python scripts/consistency_test.py --mode guide --iterations 5

# RAG 검색 일관성 (서버 필요)
uv run python scripts/consistency_test.py --mode rag --base-url https://logly.life --email test@test.com --password pass

# 전체 모드
uv run python scripts/consistency_test.py --mode all --iterations 5 --base-url https://logly.life --email test@test.com --password pass
```

- 스크립트 위치: `scripts/consistency_test.py`
- 평가 데이터셋(§2.5)을 입력으로 사용
- 각 모드별 구조 일치율, 값 일치율, 텍스트 편차율을 자동 측정하여 PASS/FAIL 판정

## 5. 사용자 피드백 기반 개선 구조

```
[사용자] ─── POST /guides/jobs/{id}/feedback ──→ [guide_feedbacks 테이블]
                                                         │
                                                         ▼
                                               [프롬프트 버전별 평균 평점 집계]
                                               GET /guides/feedback/summary
                                                         │
                                               ┌─────────┴─────────┐
                                               ▼                   ▼
                                    평점 ≥ 3.0 유지        평점 < 3.0 자동 로그 경고
                                                           → 운영팀 프롬프트 검토·개선
                                                           → GUIDE_PROMPT_VERSION 갱신
                                                           → 주간 갱신 시 최신 버전 적용
```

### 5-1. 수집 (Collection)

- 엔드포인트: `POST /guides/jobs/{id}/feedback` (`app/apis/v1/guide_routers.py:158-180`)
- 입력: 별점(1~5), 도움됨 여부(bool), 코멘트(선택)
- 프론트엔드: `frontend/src/pages/app/AiGuide.tsx` — 별점 선택 + 도움됨/아쉬움 버튼 + 코멘트 입력
- 중복 방지: `UNIQUE(guide_job_id, user_id)` 제약 + localStorage 플래그

### 5-2. 저장 (Storage)

- 테이블: `guide_feedbacks` (`app/models/guides.py:84-107`)
- 필드: `guide_job_id`, `user_id`, `rating`, `is_helpful`, `comment`, `prompt_version`, `created_at`
- `prompt_version` 필드로 어떤 프롬프트 버전이 생성한 가이드에 대한 피드백인지 추적

### 5-3. 집계 (Aggregation)

- 엔드포인트: `GET /guides/feedback/summary` (`app/services/guides.py:151-184`)
- 출력: 프롬프트 버전별 `total_count`, `average_rating`, `helpful_rate`

### 5-4. 개선 트리거 (Improvement Trigger)

- 주간 갱신 루프(`app/services/guide_automation.py:_log_low_rated_prompt_versions`)에서 **자동 감지**:
  - 매 주간 갱신 사이클마다 `guide_feedbacks` 테이블의 프롬프트 버전별 평균 평점 조회
  - 평균 평점 < 3.0인 버전 감지 시 **WARNING 로그 출력** (`low_feedback_score` 이벤트)
- 운영팀이 로그·집계 API를 확인하고 프롬프트 개선 수행
- 개선된 프롬프트를 `GUIDE_PROMPT_VERSION` 갱신하여 배포
- 주간 갱신 시 최신 프롬프트 버전으로 가이드 재생성
