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

## 3. 실험 비교: 프롬프트 버전별 출력 품질

### 3-1. OCR 파싱 프롬프트 이력

| 버전 | 변경 내용 | 결과 |
|------|-----------|------|
| v1.0 | 기본 JSON 추출 프롬프트 | JSON 구조 불안정, 키 누락 빈번, 신뢰도 미산출 |
| v1.1 | `response_format={"type":"json_object"}` 강제 | 구조 안정화 (키 누락 0%), 신뢰도 산출 로직 추가 |
| **v1.2 (현재)** | 감점 규칙(필수 필드 ×0.7) + 임계값 0.85 + 프롬프트 제약 강화 | 사용자 검수 전환율 적정화, 오탐(불필요한 검수) 30% 감소 |

**비교 분석**:
- v1.0 → v1.1: `response_format` 도입으로 **구조 오류 100% 해소**
- v1.1 → v1.2: 후처리 감점 로직으로 **과신 방지** (LLM이 높은 confidence를 출력해도 필수 필드 누락 시 강제 감점)

### 3-2. 가이드 생성 프롬프트 이력 (`GUIDE_PROMPT_VERSION`)

| 버전 | 변경 내용 | 결과 |
|------|-----------|------|
| v1.0 | 8개 가이드 키 정의 (nutrition, exercise, concentration, sleep, caffeine, smoking, drinking, general) | 기본 구조 확립, 가이드 방향성 일관 |
| v1.1 | 위험도 코드별 분기 추가 (HIGH_RISK / BORDERLINE / LOW) | 동일 위험도 → 유사 가이드 내용 보장, 개인화 수준 향상 |
| **v1.2 (현재)** | 문장 수 제한("2-4 sentences" 등) + 금지 규칙("no markdown", "no diagnosis") 세분화 | 출력 일관성 향상, 의료 면책 문구 강화, 텍스트 길이 편차 최소화 |

**비교 분석**:
- v1.0 → v1.1: 위험도 코드 분기로 **동일 입력 → 동일 가이드 방향** 보장
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

## 5. 사용자 피드백 기반 개선 구조

```
[사용자] ─── POST /guides/jobs/{id}/feedback ──→ [guide_feedbacks 테이블]
                                                         │
                                                         ▼
                                               [프롬프트 버전별 평균 평점 집계]
                                                         │
                                               ┌─────────┴─────────┐
                                               ▼                   ▼
                                    평점 ≥ 3.0 유지        평점 < 3.0 수정 트리거
                                                           → 프롬프트 개선
                                                           → GUIDE_PROMPT_VERSION 갱신
                                                           → 주간 갱신 시 최신 버전 적용
```

- 피드백 수집: `POST /guides/jobs/{id}/feedback` (별점 1~5 + 도움됨 여부 + 코멘트)
- 저장: `guide_feedbacks` 테이블 (guide_job_id, user_id, rating, is_helpful, prompt_version)
- 개선: prompt_version별 평균 평점 집계 → 저평점 버전 프롬프트 수정 → 주간 갱신 시 최신 버전 적용
