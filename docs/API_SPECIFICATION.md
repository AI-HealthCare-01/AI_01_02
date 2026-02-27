# AI Health Project API 명세서

문서 버전: v1.33  
작성일: 2026-02-27  
원본:
- `docs/요구사항_정의서.xlsx`
- `docs/API_명세서.xlsx`
- `docs/REQUIREMENTS_DEFINITION.md` (v1.28)

문서 목적: 객체 모델 명세와 API 계약 명세를 독립 문서로 관리한다.

문서 변경 이력:
- v1.33 (2026-02-27): 최신 `API_명세서.xlsx`(36건) 기준으로 schedules API 2건을 계약 표/동기화 목록에 반영하고, 미등록 API 갭(12.9)을 재정리
- v1.32 (2026-02-27): 비기능 요구사항 ID 재번호화(`REQ-101~REQ-128`)를 반영해 정책 메모/참조 REQ를 동기화하고 기준 요구사항 문서 버전을 v1.28로 갱신
- v1.31 (2026-02-27): 기준 요구사항 문서 버전을 `REQUIREMENTS_DEFINITION.md` v1.27로 동기화
- v1.30 (2026-02-27): 최신 요구사항(기능 `REQ-001~REQ-062`, 비기능 `REQ-101~REQ-128`) 갭 분석 결과를 반영해 가이드 결과 보강 필드(`source_references`, `adherence_rate_percent`)와 미등록 API 후보(REQ-010)를 문서에 명시
- v1.29 (2026-02-27): 최신 요구사항 체계(기능 `REQ-001~REQ-062`, 비기능 `REQ-101~REQ-128`)로 정책 메모의 REQ 참조를 재매핑하고 기준 요구사항 문서 버전을 v1.26으로 동기화
- v1.28 (2026-02-27): 챗봇 메시지 객체에 `status/last_token_seq/updated_at` 계약을 추가하고, 스트리밍 이탈 시 자동 중단 후 재전송 원칙(부분 응답 표시용 상태 추적)을 정책 메모에 반영
- v1.27 (2026-02-27): 챗봇 객관식 프롬프트 정책 메모의 REQ 참조를 `REQ-026`으로 정정하고 최신 문서 간 교차검증 기준으로 표기 정합성을 보강
- v1.26 (2026-02-27): 건강 프로필 객체를 `basic_info/lifestyle_input/sleep_input/nutrition_input` 4축 구조로 정리해 동기화
- v1.25 (2026-02-27): `API_명세서.xlsx` 최신본(34건) 반영으로 `DELETE /api/v1/users/me`, `DELETE /api/v1/chat/sessions/{session_id}` 계약을 복원하고 동기화 목록/정책 메모를 갱신
- v1.24 (2026-02-27): 최신 `API_명세서.xlsx` 기준 동기화 건수를 32건으로 갱신하고 미등록 경로(`DELETE /api/v1/users/me`, `DELETE /api/v1/chat/sessions/{session_id}`)를 계약 표에서 제거
- v1.23 (2026-02-27): 객체 모델 11.5에서 현재 API 계약 표(12장)와 직접 연결되지 않는 `GuideResult(계획)` 정의를 제거하고 기준 요구사항 문서 버전 참조를 갱신
- v1.22 (2026-02-27): 챗봇 세션 삭제 후 동일 `session_id` 접근 정책을 `404 RESOURCE_NOT_FOUND` 고정(미존재/삭제완료/타 사용자 접근 동일 처리)으로 명시하고 `410 Gone` 미사용 원칙을 추가
- v1.21 (2026-02-27): 회원 탈퇴 API(`DELETE /api/v1/users/me`) 처리 기준을 소프트 삭제(`is_active=false`) + 토큰 즉시 무효화로 명시하고 동기화 목록 설명을 갱신
- v1.20 (2026-02-27): 최신 `요구사항_정의서.xlsx`(v1.22) 기준으로 챗봇 삭제 범위를 세션 삭제 API로 정리하고 `API_명세서.xlsx` 동기화 목록을 34건으로 갱신
- v1.19 (2026-02-27): 최신 요구사항 정의서(v1.21)와 교차검증해 삭제 API 관련 REQ 참조를 정리하고 API 동기화 목록 35건을 유지
- v1.18 (2026-02-27): 챗봇 삭제 요구사항 반영으로 챗봇 삭제 계획 API를 추가하고 동기화 목록을 35건으로 갱신
- v1.17 (2026-02-27): 회원 탈퇴 요구사항과 연계해 인증/사용자 API에 `DELETE /api/v1/users/me` 계약(계획)을 추가하고 API 동기화 목록을 33건으로 갱신
- v1.16 (2026-02-27): `API_명세서.xlsx`의 32개 API 행(도메인/Method/Path/요약/구현상태) 동기화 목록을 문서에 추가하고 계약 외 내부 라우트 안내 문구를 정리
- v1.15 (2026-02-27): `docs/API_명세서.xlsx` 최신본 기준으로 API 엔드포인트 32건(Method/Path/상태) 정합성을 재검증하고 원본 파일 경로 표기를 업데이트
- v1.14 (2026-02-27): 최신 요구사항(v1.16/xlsx) 기준으로 REQ 참조를 전면 재매핑(`REQ-121` 원본 폐기, `REQ-106` 에러 메시지 매핑, 챗봇 정책 `REQ-037/038` 등)하고 문서 상호참조 버전을 갱신
- v1.13 (2026-02-26): 전수 정합성 점검 반영(기준 요구사항 버전 `v1.15` 갱신, 계약 외 내부 지원 라우트 표기 정리)
- v1.12 (2026-02-26): 최신 요구사항(v1.14/xlsx) 동기화, 구 프라이버시 요구사항 참조를 당시 체계의 현행 ID(`REQ-122`, 현재 `REQ-121`)로 정정, 챗봇 정책 `REQ-037/038` 반영, 계획 API 추가(`chat/prompt-options`, `medications/search`, `guides/jobs/{job_id}/refresh`), 내부 지원 API/dev 라우트 계약 표에서 제외
- v1.11 (2026-02-26): 인증/사용자 API 표 보강(`/users/me` 요청에 Bearer 토큰 필수 명시, 사용자 식별 근거 추가)
- v1.10 (2026-02-26): 외부 API 식별자 계약 일괄 string 전환(`id`, `*_id`, path 파라미터)
- v1.9 (2026-02-26): 구현 정합성 패치(`birth_date/birthday` 명명 규칙 메모, `OcrDocument.file_path` 필수화, Job 상태 타임스탬프 nullable 분리, 실패 응답 규칙 명시 강화)
- v1.8 (2026-02-24): 구현 DTO 정합화 반영(로그인 응답 필드, OCR/가이드 작업 생성 응답 객체, 상태 응답 보조 필드)
- v1.7 (2026-02-24): 구현 API 실사 기반 정합화(알림 v2 capability 조회, dev 알림 플레이그라운드 경로 명시)
- v1.6 (2026-02-24): OCR 좌표(`raw_blocks`) 선택 저장 정책(저신뢰 우선) 명시 및 큐 실패 시 원본 즉시 폐기 경로 반영
- v1.5 (2026-02-24): 작업 생성 큐 등록 실패 시 503/FAILED 처리 정책 반영(정책 메모/에러 코드 매핑)
- v1.4 (2026-02-24): 구현 API 응답 스키마 정합화 반영(OCR/가이드 결과 객체, 실패 응답 형식 메모 보강)
- v1.3 (2026-02-24): `알약 이미지 분류 기반 복약 분석` 기능 제외 반영(객체/API/에러코드 정리)
- v1.2 (2026-02-23): 챗봇/OCR 계약 정합성 보강(출처 객체, 저유사도 재질문 플래그, 자동 세션 종료 메타, OCR 원본 이미지 폐기 정책 명시)
- v1.1 (2026-02-23): 객체 모델 및 API 계약 명세 보강

## 11. 객체 모델 명세 (필수/선택)

표기 규칙:
- `필수(Required)`: 요청/응답에 반드시 포함
- `선택(Optional)`: 상황에 따라 생략 가능
- `nullable`: 키는 존재하나 값은 `null` 허용

### 11.1 공통 객체

| 객체명 | 필드 | 타입 | 필수/선택 | 설명 |
|---|---|---|---|---|
| ApiError | code | string | 필수 | 시스템 오류 코드 (`AUTH_INVALID_TOKEN`, `OCR_LOW_CONFIDENCE` 등) |
| ApiError | message | string | 필수 | 사용자/개발자 공통 에러 메시지 |
| ApiError | detail | object \| string \| null | 선택(nullable) | 상세 원인, 필드 오류 목록 |
| ApiError | request_id | string | 선택 | 추적용 요청 ID |
| ApiError | timestamp | string(datetime) | 필수 | 에러 발생 시각 |
| PaginationMeta | limit | int | 필수 | 페이지 크기 |
| PaginationMeta | offset | int | 필수 | 시작 오프셋 |
| PaginationMeta | total | int | 필수 | 전체 개수 |
| ErrorMessageMapping | error_code | string | 필수 | 백엔드 표준 오류 코드 |
| ErrorMessageMapping | user_message | string | 필수 | 사용자 노출 문구 |
| ErrorMessageMapping | developer_message | string | 선택 | 운영/개발자 상세 문구 |
| ErrorMessageMapping | action_hint | enum | 선택 | `retry`, `reupload`, `edit`, `contact_support` |
| ErrorMessageMapping | retryable | bool | 필수 | 재시도 가능 여부 |

정책 메모:
- 현재 구현(v1) 실패 응답은 FastAPI 기본 형식(`{"detail":"..."}`)을 사용한다.
- `ApiError` 객체 표준화는 목표 계약이며, 점진 반영한다.
- 외부 API 식별자(`id`, `*_id`, path 파라미터)는 언어/플랫폼 정밀도 이슈를 피하기 위해 string으로 계약한다.

### 11.2 인증/사용자 객체

| 객체명 | 필드 | 타입 | 필수/선택 | 설명 |
|---|---|---|---|---|
| SignUpRequest | email | string(email) | 필수 | 로그인 ID |
| SignUpRequest | password | string | 필수 | 비밀번호 정책 충족 |
| SignUpRequest | name | string | 필수 | 실명 |
| SignUpRequest | gender | enum(`MALE`,`FEMALE`) | 필수 | 성별 |
| SignUpRequest | birth_date | string(date) | 필수 | 생년월일 |
| SignUpRequest | phone_number | string | 필수 | 휴대폰 번호 |
| LoginRequest | email | string(email) | 필수 | 로그인 ID |
| LoginRequest | password | string | 필수 | 비밀번호 |
| LoginResponse | access_token | string | 필수 | JWT access token |
| UserInfo | id | string | 필수 | 사용자 ID |
| UserInfo | name | string | 필수 | 이름 |
| UserInfo | email | string | 필수 | 이메일 |
| UserInfo | phone_number | string | 필수 | 휴대폰 번호 |
| UserInfo | birthday | string(date) | 필수 | 생년월일 |
| UserInfo | gender | enum | 필수 | 성별 |
| UserInfo | created_at | string(datetime) | 필수 | 가입시각 |
| UserUpdateRequest | name/email/phone_number/birthday/gender | mixed | 선택 | 부분 업데이트(PATCH) |

정책 메모:
- 현재 구현(v1) 기준으로 회원가입 요청은 `birth_date`를 사용하고, 내 정보 조회/수정은 `birthday`를 사용한다.
- 필드명 통합(예: `birth_date`)은 호환성 영향이 있어 차기 버전(v2)에서 일괄 반영한다.

### 11.3 건강 프로필 객체

| 객체명 | 필드 | 타입 | 필수/선택 | 설명 |
|---|---|---|---|---|
| HealthProfileUpsertRequest | basic_info | object | 필수 | 신체 기초 정보 |
| HealthProfileUpsertRequest | lifestyle_input | object | 선택 | 운동/디지털/기호품 |
| HealthProfileUpsertRequest | sleep_input | object | 선택 | 수면 패턴 |
| HealthProfileUpsertRequest | nutrition_input | object | 선택 | 영양/식사 정보 |
| HealthProfile | id/user_id | string | 필수 | 건강 프로필 식별자 |
| HealthProfile | basic_info/lifestyle_input/sleep_input/nutrition_input | object | 필수 | 저장된 프로필 입력 구조 |
| HealthProfile | created_at/updated_at | string(datetime) | 필수 | 생성/수정 시각 |
| basic_info | height_cm | float | 필수 | 키(cm) |
| basic_info | weight_kg | float | 필수 | 체중(kg) |
| basic_info | drug_allergies | string[] | 선택 | 약물 알러지 |
| lifestyle_input.exercise_hours | low_intensity/moderate_intensity/high_intensity | int | 선택 | 주간 운동 시간 |
| lifestyle_input.digital_usage | pc_hours_per_day/smartphone_hours_per_day | int | 선택 | 일 평균 사용 시간 |
| lifestyle_input.substance_usage | caffeine_cups_per_day/smoking/alcohol_frequency_per_week | int | 선택 | 기호품 지표 |
| sleep_input | bed_time/wake_time | string(`HH:MM`) | 선택 | 취침/기상 |
| sleep_input | sleep_latency_minutes/night_awakenings_per_week/daytime_sleepiness_score | int | 선택 | 수면 품질 지표 |
| nutrition_input | appetite_score | int(0~10) | 선택 | 식욕 지표 |
| nutrition_input | is_meal_regular | bool | 선택 | 식사 규칙성 |

### 11.4 OCR 객체

| 객체명 | 필드 | 타입 | 필수/선택 | 설명 |
|---|---|---|---|---|
| OcrDocument | id | string | 필수 | 업로드 문서 ID |
| OcrDocument | document_type | enum | 필수 | 문서 타입 |
| OcrDocument | file_name | string | 필수 | 업로드 파일명 |
| OcrDocument | file_path | string | 필수 | 현재 구현 응답에 포함되는 저장 상대경로(원본 파일 폐기 이후에도 메타데이터로 유지) |
| OcrDocument | mime_type | string | 필수 | 파일 MIME 타입 |
| OcrDocument | file_size | int | 필수 | 파일 크기(byte) |
| OcrDocument | uploaded_at | string(datetime) | 필수 | 업로드 시각 |
| OcrDocumentUploadRequest | document_type | enum | 필수 | 문서 타입 |
| OcrDocumentUploadRequest | file | file | 필수 | 업로드 파일 |
| OcrJobCreateRequest | document_id | string | 필수 | OCR 대상 문서 ID |
| OcrJobCreateResponse | job_id/status/retry_count/max_retries/queued_at | mixed | 필수 | 작업 생성 직후 반환 메타데이터(`job_id`는 string) |
| OcrJobStatus | job_id | string | 필수 | OCR job ID |
| OcrJobStatus | document_id | string | 필수 | 원본 문서 ID |
| OcrJobStatus | status | enum(`QUEUED`,`PROCESSING`,`SUCCEEDED`,`FAILED`) | 필수 | 상태 |
| OcrJobStatus | retry_count/max_retries | int | 필수 | 재시도 정보 |
| OcrJobStatus | failure_code/error_message | string \| null | 선택(nullable) | 실패 정보 |
| OcrJobStatus | queued_at | string(datetime) | 필수 | 큐 등록 시각 |
| OcrJobStatus | started_at/completed_at | string(datetime) \| null | 선택(nullable) | 처리 시작/완료 시각 메타데이터 |
| OcrJobResult | job_id | string | 필수 | OCR job ID |
| OcrJobResult | extracted_text | string | 필수 | OCR 추출 원문(베이스라인 구현) |
| OcrJobResult | structured_data | object | 필수 | 베이스라인 구조화 결과(JSON) |
| OcrJobResult | created_at/updated_at | string(datetime) | 필수 | 결과 생성/수정 시각 |
| OcrRawBlock | text | string | 필수 | OCR 원문 블록(선택 저장 대상) |
| OcrRawBlock | bbox | number[] | 필수 | 좌표(선택 저장 대상) |
| OcrRawBlock | confidence | float | 선택 | OCR 블록 신뢰도(선택 저장 대상) |
| OcrMedicationItem | drug_name | string | 필수 | 약물명 |
| OcrMedicationItem | dose | float | 선택 | 용량 |
| OcrMedicationItem | frequency_per_day | int | 선택 | 1일 복용 횟수 |
| OcrMedicationItem | dosage_per_once | int | 선택 | 1회 복용 개수 |
| OcrMedicationItem | intake_time | enum | 선택 | 복용 시점(`morning/lunch/dinner/bedtime/PRN`) |
| OcrMedicationItem | administration_timing | enum | 선택 | 식전/식후 규칙 |
| OcrMedicationItem | dispensed_date | string(date) | 선택 | 조제일 |
| OcrMedicationItem | total_days | int | 선택 | 총 처방일 |
| OcrMedicationItem | confidence | float | 선택 | 필드 신뢰도 |
| OcrResult(계획) | raw_text | string | 필수 | OCR 원문 |
| OcrResult(계획) | raw_blocks | OcrRawBlock[] | 선택 | 검수 UI용 좌표 정보(저신뢰/사용자 검토 케이스 우선 저장) |
| OcrResult(계획) | extracted_medications | OcrMedicationItem[] | 필수 | 구조화 약물 결과 |
| OcrResult(계획) | overall_confidence | float | 선택 | 전체 신뢰도 |
| OcrResult(계획) | needs_user_review | bool | 필수 | 사용자 검토 필요 여부 |
| OcrReviewConfirmRequest | confirmed | bool | 필수 | 자동 인식 결과 확정 여부 |
| OcrReviewConfirmRequest | corrected_medications | OcrMedicationItem[] | 선택 | 사용자 수정값 |
| OcrReviewConfirmRequest | comment | string | 선택 | 수정 사유/메모 |
| MedicationSearchItem | medication_id/name | string | 필수 | 자동완성 후보 식별자/약물명 |
| MedicationSearchItem | score | float | 선택 | 검색 유사도/정렬 점수 |
| MedicationSearchResponse | items | MedicationSearchItem[] | 필수 | 약물명 검색 추천 목록 |

### 11.5 가이드/분석 객체

| 객체명 | 필드 | 타입 | 필수/선택 | 설명 |
|---|---|---|---|---|
| GuideJobCreateRequest | ocr_job_id | string | 필수 | 가이드 원천 OCR job |
| GuideJobCreateResponse | job_id/status/retry_count/max_retries/queued_at | mixed | 필수 | 작업 생성 직후 반환 메타데이터(`job_id`는 string) |
| GuideJobStatus | job_id | string | 필수 | 가이드 job ID |
| GuideJobStatus | ocr_job_id | string | 필수 | 원천 OCR job ID |
| GuideJobStatus | status | enum(`QUEUED`,`PROCESSING`,`SUCCEEDED`,`FAILED`) | 필수 | 상태 |
| GuideJobStatus | retry_count/max_retries | int | 필수 | 재시도 정보 |
| GuideJobStatus | failure_code/error_message | string \| null | 선택(nullable) | 실패 정보 |
| GuideJobStatus | queued_at | string(datetime) | 필수 | 큐 등록 시각 |
| GuideJobStatus | started_at/completed_at | string(datetime) \| null | 선택(nullable) | 처리 시작/완료 시각 메타데이터 |
| GuideJobResult | job_id | string | 필수 | 가이드 job ID |
| GuideJobResult | medication_guidance/lifestyle_guidance | string | 필수 | 베이스라인 가이드 텍스트 |
| GuideJobResult | risk_level | enum(`LOW`,`MEDIUM`,`HIGH`) | 필수 | 가이드 위험도 |
| GuideJobResult | safety_notice | string | 필수 | 의료진 상담 고지 |
| GuideJobResult | source_references | GuideSourceReference[] | 선택 | 가이드 근거 출처 목록(REQ-005) |
| GuideJobResult | adherence_rate_percent | float | 선택 | 최근 일정 이행률(0~100, REQ-008) |
| GuideJobResult | structured_data | object | 필수 | 생성 메타데이터(JSON) |
| GuideJobResult | created_at/updated_at | string(datetime) | 필수 | 결과 생성/수정 시각 |
| GuideSourceReference | title | string | 필수 | 근거 문서 제목 |
| GuideSourceReference | source | string | 필수 | 기관/데이터 출처명 |
| GuideSourceReference | url | string | 선택 | 근거 링크 |
| GuideSourceReference | used_at | string(datetime) | 선택 | 근거 사용 시각 |
| GuideRefreshRequest | reason | string | 선택 | 갱신 트리거 사유(`weekly`, `user_input_changed`) |
| GuideRefreshResponse | refreshed_job_id/status | mixed | 필수 | 재생성된 가이드 작업 ID 및 상태 |
| AnalysisSummary | basic_info/lifestyle_analysis/sleep_analysis/nutrition_analysis | object | 필수 | 지표 분석 결과 |
| AnalysisSummary | risk_flags | RiskFlag[] | 선택 | 위험 징후 플래그 목록(REQ-014) |
| AnalysisSummary | allergy_alerts | AllergyAlert[] | 선택 | 약물 알러지 충돌 경고 목록(REQ-015) |
| RiskFlag | code | string | 필수 | 위험 코드 |
| RiskFlag | level | enum(`LOW`,`MEDIUM`,`HIGH`) | 필수 | 위험도 |
| RiskFlag | message | string | 필수 | 사용자 경고 문구 |
| AllergyAlert | medication_name | string | 필수 | 충돌 약물명 |
| AllergyAlert | allergy_substance | string | 필수 | 사용자 알러지 정보 |
| AllergyAlert | severity | enum(`LOW`,`MEDIUM`,`HIGH`) | 필수 | 충돌 심각도 |
| AllergyAlert | message | string | 필수 | 사용자 경고 문구 |

### 11.6 챗봇 객체

| 객체명 | 필드 | 타입 | 필수/선택 | 설명 |
|---|---|---|---|---|
| ChatSessionCreateRequest | title | string | 선택 | 세션 제목 |
| ChatSession | id | string | 필수 | 세션 ID |
| ChatSession | status | enum(`ACTIVE`,`CLOSED`) | 필수 | 세션 상태 |
| ChatSession | last_activity_at | string(datetime) | 선택 | 마지막 활동 시각 |
| ChatSession | auto_close_after_minutes | int | 선택 | 자동 종료 기준(분) |
| ChatPromptOption | id | string | 필수 | 객관식 프롬프트 식별자 |
| ChatPromptOption | label | string | 필수 | 사용자 노출 문구 |
| ChatPromptOption | category | string | 선택 | 분류(`medication`, `side_effect`, `lifestyle`, `free`) |
| ChatPromptOptionsResponse | items | ChatPromptOption[] | 필수 | 챗봇 진입 시 제공할 프롬프트 목록 |
| ChatMessageSendRequest | message | string | 필수 | 사용자 질문 |
| ChatMessageSendRequest | stream | bool | 선택 | SSE 여부(기본 true) |
| ChatReference | document_id | string | 필수 | 근거 문서 식별자 |
| ChatReference | title | string | 필수 | 근거 문서 제목 |
| ChatReference | source | string | 필수 | 출처명(기관/사이트) |
| ChatReference | url | string | 선택 | 근거 링크 |
| ChatReference | score | float | 선택 | 검색 유사도/랭킹 점수 |
| ChatMessage | id | string | 필수 | 메시지 ID |
| ChatMessage | role | enum(`USER`,`ASSISTANT`,`SYSTEM`) | 필수 | 역할 |
| ChatMessage | status | enum(`PENDING`,`STREAMING`,`COMPLETED`,`FAILED`,`CANCELLED`) | 필수 | 메시지 생성/스트리밍 상태 |
| ChatMessage | content | string | 필수 | 메시지 본문 |
| ChatMessage | last_token_seq | int | 선택 | 마지막으로 저장된 토큰 순번(부분 응답 복구 표시용) |
| ChatMessage | references | ChatReference[] | 선택 | RAG 근거 문서(근거가 있을 때만 포함) |
| ChatMessage | needs_clarification | bool | 선택 | 저유사도 질의로 재질문 유도 여부 |
| ChatMessage | updated_at | string(datetime) | 선택 | 최근 상태/토큰 갱신 시각 |
| ChatStreamEvent | event | string | 필수 | `token`, `reference`, `done`, `error` |
| ChatStreamEvent | data | object | 필수 | 이벤트 payload |

### 11.7 알림/리마인더 객체

| 객체명 | 필드 | 타입 | 필수/선택 | 설명 |
|---|---|---|---|---|
| Notification | id/type/title/message/is_read/created_at | mixed | 필수 | 알림 기본 필드(`id`는 string) |
| Notification | read_at/payload | mixed | 선택(nullable) | 읽음 시각/부가정보 |
| MedicationReminderUpsertRequest | medication_name | string | 필수 | 약물명 |
| MedicationReminderUpsertRequest | dose | string | 선택 | 복용량 텍스트 |
| MedicationReminderUpsertRequest | schedule_times | string[](`HH:MM`) | 필수 | 알림 시각 배열 |
| MedicationReminderUpsertRequest | start_date/end_date | string(date) | 선택 | 적용 기간 |
| MedicationReminderUpsertRequest | enabled | bool | 선택 | 알림 활성화 |
| Reminder | id | string | 필수 | 리마인더 ID |
| Reminder | medication_name | string | 필수 | 약물명 |
| Reminder | dose | string | 선택 | 복용량 텍스트 |
| Reminder | schedule_times | string[](`HH:MM`) | 필수 | 알림 시각 배열 |
| Reminder | start_date/end_date | string(date) \| null | 선택(nullable) | 적용 기간 |
| Reminder | enabled | bool | 필수 | 활성화 여부 |
| Reminder | created_at/updated_at | string(datetime) | 필수 | 생성/수정 시각 |
| DdayReminder | medication_name | string | 필수 | 약물명 |
| DdayReminder | remaining_days | int | 필수 | 소진까지 남은 일수 |
| DdayReminder | estimated_depletion_date | string(date) | 필수 | 소진 예상일 |

### 11.8 일정 객체

| 객체명 | 필드 | 타입 | 필수/선택 | 설명 |
|---|---|---|---|---|
| DailyScheduleResponse | date | string(date) | 필수 | 조회 기준일 |
| DailyScheduleResponse | items | ScheduleItem[] | 필수 | 시계열 일정 목록 |
| ScheduleItem | item_id | string | 필수 | 일정 항목 ID |
| ScheduleItem | category | enum(`MEDICATION`,`MEAL`,`SLEEP`) | 필수 | 일정 분류 |
| ScheduleItem | title | string | 필수 | 일정 제목 |
| ScheduleItem | scheduled_at | string(datetime) | 필수 | 예정 시각 |
| ScheduleItem | status | enum(`PENDING`,`DONE`,`SKIPPED`) | 필수 | 이행 상태 |
| ScheduleItem | completed_at | string(datetime) \| null | 선택(nullable) | 완료 시각 |
| ScheduleItemStatusUpdateRequest | status | enum(`DONE`,`SKIPPED`,`PENDING`) | 필수 | 변경할 이행 상태 |
| ScheduleItemStatusUpdateRequest | completed_at | string(datetime) \| null | 선택(nullable) | 완료 처리 시각 |


## 12. API 계약 명세 (Request/Response)

### 12.1 공통 규칙

- 인증: 보호 API는 `Authorization: Bearer <access_token>` 필수
- 보호 API의 사용자 식별은 `access_token` payload의 `user_id`를 기준으로 수행한다(요청 파라미터로 `user_id`를 받지 않음).
- Content-Type:
  - JSON API: `application/json`
  - 파일 업로드: `multipart/form-data`
  - 스트리밍: `text/event-stream`
- 성공 응답: HTTP 표준코드 + 객체 본문
- 실패 응답(현재 구현): FastAPI 기본 오류 객체 `{"detail":"..."}` 중심(엔드포인트별 HTTP 상태코드를 우선 계약으로 본다)
- 실패 응답(목표 계약): `ApiError` 객체 표준화 + `ErrorMessageMapping` 기반 사용자 메시지 매핑(`REQ-111`)
- 외부 API의 식별자(`id`, `*_id`, path 파라미터)는 string 계약을 따른다.
- 본 문서는 `docs/API_명세서.xlsx` 기준 사용자/서비스 API 계약 범위를 다룬다.

### 12.2 인증/사용자 API

| Method | Path | 상태 | Request (필수/선택) | Success Response |
|---|---|---|---|---|
| POST | `/api/v1/auth/signup` | 대기중 | `SignUpRequest` (필수: `email,password,name,gender,birth_date,phone_number`) | `201 {"detail":"회원가입이 성공적으로 완료되었습니다."}` |
| POST | `/api/v1/auth/login` | 대기중 | `LoginRequest` (필수: `email,password`) | `200 LoginResponse` + `refresh_token` 쿠키 |
| GET | `/api/v1/auth/token/refresh` | 대기중 | 쿠키 `refresh_token` (필수) | `200 {"access_token":"..."}` |
| GET | `/api/v1/users/me` | 대기중 | 헤더 `Authorization: Bearer <access_token>` (필수) | `200 UserInfo` |
| PATCH | `/api/v1/users/me` | 대기중 | 헤더 `Authorization: Bearer <access_token>` (필수), `UserUpdateRequest` (모든 필드 선택) | `200 UserInfo` |
| DELETE | `/api/v1/users/me` | 대기중 | 헤더 `Authorization: Bearer <access_token>` (필수) | `204` |
| PUT | `/api/v1/profiles/health` | 대기중 | 헤더 `Authorization: Bearer <access_token>` (필수), `HealthProfileUpsertRequest` (`basic_info` 필수) | `200 HealthProfile` |
| GET | `/api/v1/profiles/health` | 대기중 | 헤더 `Authorization: Bearer <access_token>` (필수) | `200 HealthProfile` |

정책 메모:
- 현재 구현(v1)에서 `signup`은 `birth_date`를, `users/me` 조회/수정은 `birthday`를 사용한다.
- JWT 인증/사용자 식별 규칙은 `REQ-028`, `REQ-107`, `REQ-108`을 따른다.
- 회원 탈퇴 API(`DELETE /api/v1/users/me`)는 `REQ-027` 기준 계획 항목이며, 하드 삭제 대신 소프트 삭제(`is_active=false`)를 적용한다.
- 탈퇴 완료 시 access/refresh token을 즉시 무효화하고, 탈퇴 계정의 보호 리소스 접근을 차단한다.

### 12.3 OCR/가이드 API

| Method | Path | 상태 | Request (필수/선택) | Success Response |
|---|---|---|---|---|
| POST | `/api/v1/ocr/documents/upload` | 대기중 | 헤더 `Authorization: Bearer <access_token>` (필수), multipart: `document_type`(필수), `file`(필수) | `201 OcrDocument` |
| POST | `/api/v1/ocr/jobs` | 대기중 | 헤더 `Authorization: Bearer <access_token>` (필수), `{"document_id": string}` (필수) | `202 OcrJobCreateResponse` |
| GET | `/api/v1/ocr/jobs/{job_id}` | 대기중 | 헤더 `Authorization: Bearer <access_token>` (필수), path `job_id`(string, 필수) | `200 OcrJobStatus` |
| GET | `/api/v1/ocr/jobs/{job_id}/result` | 대기중 | 헤더 `Authorization: Bearer <access_token>` (필수), path `job_id`(string, 필수) | `200 OcrJobResult` |
| PATCH | `/api/v1/ocr/jobs/{job_id}/confirm` | 대기중 | 헤더 `Authorization: Bearer <access_token>` (필수), path `job_id`(string, 필수), `OcrReviewConfirmRequest` (`confirmed` 필수) | `200 OcrResult(계획)` |
| GET | `/api/v1/medications/search` | 대기중 | 헤더 `Authorization: Bearer <access_token>` (필수), query `q`(필수), `limit`(선택, 기본 10) | `200 MedicationSearchResponse` |
| POST | `/api/v1/guides/jobs` | 대기중 | 헤더 `Authorization: Bearer <access_token>` (필수), `{"ocr_job_id": string}` (필수) | `202 GuideJobCreateResponse` |
| GET | `/api/v1/guides/jobs/{job_id}` | 대기중 | 헤더 `Authorization: Bearer <access_token>` (필수), path `job_id`(string, 필수) | `200 GuideJobStatus` |
| GET | `/api/v1/guides/jobs/{job_id}/result` | 대기중 | 헤더 `Authorization: Bearer <access_token>` (필수), path `job_id`(string, 필수) | `200 GuideJobResult` |
| POST | `/api/v1/guides/jobs/{job_id}/refresh` | 대기중 | 헤더 `Authorization: Bearer <access_token>` (필수), path `job_id`(string, 필수), `GuideRefreshRequest`(선택) | `202 GuideRefreshResponse` |
| GET | `/api/v1/analysis/summary` | 대기중 | 헤더 `Authorization: Bearer <access_token>` (필수), query: `date_from,date_to`(선택) | `200 AnalysisSummary` |
| GET | `/api/v1/schedules/daily` | 대기중 | 헤더 `Authorization: Bearer <access_token>` (필수), query `date`(필수), `timezone`(선택) | `200 DailyScheduleResponse` |
| PATCH | `/api/v1/schedules/items/{item_id}/status` | 대기중 | 헤더 `Authorization: Bearer <access_token>` (필수), path `item_id`(string, 필수), `ScheduleItemStatusUpdateRequest` (`status` 필수) | `200 ScheduleItem` |

정책 메모:
- OCR/파싱 완료 후 원본 업로드 이미지는 즉시 폐기하며, DB/클라우드 스토리지에 파일 형태로 보관하지 않는다 (`REQ-126`).
- 큐 등록 실패로 비동기 처리가 시작되지 못한 경우에도 원본 파일은 즉시 폐기한다 (`REQ-126`).
- OCR/가이드 작업 생성 시 큐 등록 실패가 발생하면 서버는 `503`을 반환하고 해당 job을 `FAILED`로 마킹한다(고착 방지, `REQ-118`, `REQ-120`).
- OCR 블록 좌표(`raw_blocks`)는 필수 영속 저장 대상이 아니며, 저신뢰/검수 필요 케이스 중심으로 선택 저장할 수 있다 (`REQ-055`, `REQ-061`, `REQ-062`, `REQ-124`).
- 약물명 자동완성 API는 OCR 사용자 수정 단계의 오타 방지/매핑 정확도 향상을 위한 보조 계약이다 (`REQ-062`).
- 가이드 갱신 API는 최근 1주 입력 데이터 기반 주기 갱신 요구사항을 지원하는 계획 계약이다 (`REQ-007`).

### 12.4 챗봇 API

| Method | Path | 상태 | Request (필수/선택) | Success Response |
|---|---|---|---|---|
| GET | `/api/v1/chat/prompt-options` | 대기중 | 헤더 `Authorization: Bearer <access_token>` (필수) | `200 ChatPromptOptionsResponse` |
| POST | `/api/v1/chat/sessions` | 대기중 | 헤더 `Authorization: Bearer <access_token>` (필수), `{"title": string}` (선택) | `201 ChatSession` |
| GET | `/api/v1/chat/sessions/{session_id}/messages` | 대기중 | 헤더 `Authorization: Bearer <access_token>` (필수), path `session_id`(string, 필수), query `limit,offset`(선택) | `200 {"items": ChatMessage[], "meta": PaginationMeta}` |
| POST | `/api/v1/chat/sessions/{session_id}/messages` | 대기중 | 헤더 `Authorization: Bearer <access_token>` (필수), `ChatMessageSendRequest` (`message` 필수, `stream` 선택) | `200 ChatMessage` |
| POST | `/api/v1/chat/sessions/{session_id}/stream` | 대기중 | 헤더 `Authorization: Bearer <access_token>` (필수), `ChatMessageSendRequest` (`message` 필수) | `200 text/event-stream (ChatStreamEvent)` |
| DELETE | `/api/v1/chat/sessions/{session_id}` | 대기중 | 헤더 `Authorization: Bearer <access_token>` (필수), path `session_id`(string, 필수) | `204` |

정책 메모:
- 챗봇 진입 시 객관식 대화 프롬프트를 제공한다 (`REQ-030`).
- 챗봇 세션 삭제 API는 `REQ-043` 기준 계획 항목이다.
- 챗봇 세션 삭제 후 동일 `session_id`로 조회/전송/스트리밍/재삭제를 요청하면 서버는 `404 RESOURCE_NOT_FOUND`를 반환한다(미존재/삭제완료/타 사용자 세션 접근 모두 동일). `410 Gone`은 사용하지 않는다.
- 챗봇 메시지는 `status` 상태 머신(`PENDING -> STREAMING -> COMPLETED/FAILED/CANCELLED`)을 따른다.
- 스트리밍 연결이 중단되면 서버는 메시지를 자동 중단 처리(`CANCELLED` 또는 `FAILED`)하고, 완전한 이어쓰기(resume generation)는 지원하지 않는다.
- `last_token_seq`와 `updated_at`은 부분 응답 표시/최근 상태 정렬 용도로 사용하며, 사용자 복구 액션은 재전송(새 메시지 생성)으로 처리한다.
- 세션 메시지 목록은 최근 상태 확인이 가능하도록 `updated_at` 최신순 정렬을 기본값으로 권장한다.
- 검색 유사도가 임계값 미만이면 `needs_clarification=true` 메시지로 재질문을 유도할 수 있다 (`REQ-042`).
- 세션은 비활성 10~30분 경과 시 자동 `CLOSED` 처리될 수 있다 (`REQ-044`).
- 위급 질의 감지 시 LLM 호출 차단 및 긴급 상담 문구 우선 반환 정책을 적용한다 (`REQ-035`, `REQ-117`).

### 12.5 알림/리마인더 API

| Method | Path | 상태 | Request (필수/선택) | Success Response |
|---|---|---|---|---|
| GET | `/api/v1/notifications` | 대기중 | 헤더 `Authorization: Bearer <access_token>` (필수), query `limit,offset,is_read`(선택) | `200 {"items": Notification[], "unread_count": int}` |
| GET | `/api/v1/notifications/unread-count` | 대기중 | 헤더 `Authorization: Bearer <access_token>` (필수) | `200 {"unread_count": int}` |
| PATCH | `/api/v1/notifications/{notification_id}/read` | 대기중 | 헤더 `Authorization: Bearer <access_token>` (필수), path `notification_id`(string, 필수) | `200 Notification` |
| PATCH | `/api/v1/notifications/read-all` | 대기중 | 헤더 `Authorization: Bearer <access_token>` (필수) | `200 {"updated_count": int}` |
| POST | `/api/v1/reminders` | 대기중 | 헤더 `Authorization: Bearer <access_token>` (필수), `MedicationReminderUpsertRequest` (`medication_name,schedule_times` 필수) | `201 Reminder` |
| GET | `/api/v1/reminders` | 대기중 | 헤더 `Authorization: Bearer <access_token>` (필수), query `enabled`(선택) | `200 {"items": Reminder[]}` |
| PATCH | `/api/v1/reminders/{reminder_id}` | 대기중 | 헤더 `Authorization: Bearer <access_token>` (필수), path `reminder_id`(string, 필수), `MedicationReminderUpsertRequest` (모든 필드 선택) | `200 Reminder` |
| DELETE | `/api/v1/reminders/{reminder_id}` | 대기중 | 헤더 `Authorization: Bearer <access_token>` (필수), path `reminder_id`(string, 필수) | `204` |
| GET | `/api/v1/reminders/medication-dday` | 대기중 | 헤더 `Authorization: Bearer <access_token>` (필수), query `days`(선택, 기본 7) | `200 {"items": DdayReminder[]}` |

정책 메모:
- 약 소진 D-day 계산은 조제일/복용주기/복용개수 기준으로 오차 없이 수행해야 한다 (`REQ-021`, `REQ-121`).

### 12.6 대표 에러 코드 매핑

정책 메모:
- 현재 구현(v1) 다수 엔드포인트는 `detail` 문자열 기반 오류 응답을 사용한다.
- 아래 `code` 매핑은 표준화 목표 코드이며, 구현 범위에 따라 단계적으로 반영한다.
- 프론트엔드는 `error_code -> user_message/action_hint` 테이블을 유지해 일관된 UX를 제공한다 (`REQ-012`, `REQ-111`, `REQ-120`).

| HTTP | code 예시 | 발생 상황 | action_hint |
|---|---|---|---|
| 400 | `VALIDATION_ERROR` | 필수 필드 누락, 형식 오류 | `edit` |
| 401 | `AUTH_INVALID_TOKEN` | 토큰 누락/만료 | `retry` |
| 403 | `AUTH_FORBIDDEN` | 권한 없는 리소스 접근 | `contact_support` |
| 404 | `RESOURCE_NOT_FOUND` | 대상 리소스 없음 | `edit` |
| 409 | `STATE_CONFLICT` | 처리 상태 미충족(예: OCR 미완료 상태에서 가이드 요청) | `retry` |
| 413 | `FILE_TOO_LARGE` | 파일 크기 제한 초과 | `reupload` |
| 422 | `OCR_LOW_CONFIDENCE` | OCR 신뢰도 임계값 미달 | `edit` |
| 429 | `RATE_LIMITED` | 요청 과다 | `retry` |
| 500 | `INTERNAL_ERROR` | 서버 내부 오류 | `retry` |
| 502 | `UPSTREAM_OCR_ERROR` | 외부 OCR API 실패 | `retry` |
| 503 | `QUEUE_UNAVAILABLE` | 비동기 작업 큐 등록 실패(서비스 일시 불가) | `retry` |
| 504 | `UPSTREAM_TIMEOUT` | 외부 LLM/OCR 타임아웃 | `retry` |

### 12.7 운영 안정성 연계 정책 (비계약)

- 장애 감지: HTTP 5xx 에러율 급증, OCR/LLM 타임아웃 연속 발생을 실시간 모니터링하고 임계치 초과 시 담당자에게 즉시 경고한다 (`REQ-119`).
- 장애 복구: 크리티컬 장애 시 30분 이내 롤백 또는 임시 복구(Fallback) 절차를 수행한다 (`REQ-101`).
- 본 항목은 API endpoint 계약이 아니라 운영 요구사항 연계 메모다.

### 12.8 API_명세서.xlsx 동기화 목록

- 기준: `docs/API_명세서.xlsx` `origin` 시트
- 동기화 건수: 36건

| 도메인 | Method | Path | 기능 요약 | 완료 상태 |
|---|---|---|---|---|
| V1 | POST | `/api/v1/auth/signup` | 회원가입 | 대기중 |
| V1 | POST | `/api/v1/auth/login` | 로그인 | 대기중 |
| V1 | GET | `/api/v1/auth/token/refresh` | 액세스 토큰 재발급 | 대기중 |
| V1 | GET | `/api/v1/users/me` | 내 정보 조회 | 대기중 |
| V1 | PATCH | `/api/v1/users/me` | 내 정보 수정 | 대기중 |
| V1 | DELETE | `/api/v1/users/me` | 회원 탈퇴(소프트 삭제) | 대기중 |
| V1 | PUT | `/api/v1/profiles/health` | 건강 프로필 저장/갱신 | 대기중 |
| V1 | GET | `/api/v1/profiles/health` | 건강 프로필 조회 | 대기중 |
| V1 | POST | `/api/v1/ocr/documents/upload` | OCR 문서 업로드 | 대기중 |
| V1 | POST | `/api/v1/ocr/jobs` | OCR 작업 생성 | 대기중 |
| V1 | GET | `/api/v1/ocr/jobs/{job_id}` | OCR 작업 상태 조회 | 대기중 |
| V1 | GET | `/api/v1/ocr/jobs/{job_id}/result` | OCR 결과 조회 | 대기중 |
| V1 | PATCH | `/api/v1/ocr/jobs/{job_id}/confirm` | OCR 수정 확정 | 대기중 |
| V1 | GET | `/api/v1/medications/search` | 약물명 자동완성 검색 | 대기중 |
| V1 | POST | `/api/v1/guides/jobs` | 가이드 작업 생성 | 대기중 |
| V1 | GET | `/api/v1/guides/jobs/{job_id}` | 가이드 작업 상태 조회 | 대기중 |
| V1 | GET | `/api/v1/guides/jobs/{job_id}/result` | 가이드 결과 조회 | 대기중 |
| V1 | POST | `/api/v1/guides/jobs/{job_id}/refresh` | 가이드 재생성 작업 생성 | 대기중 |
| V1 | GET | `/api/v1/analysis/summary` | 분석 요약 조회 | 대기중 |
| V1 | GET | `/api/v1/schedules/daily` | 일일 일정 조회 | 대기중 |
| V1 | PATCH | `/api/v1/schedules/items/{item_id}/status` | 일정 항목 상태 업데이트 | 대기중 |
| V1 | GET | `/api/v1/chat/prompt-options` | 챗봇 객관식 프롬프트 조회 | 대기중 |
| V1 | POST | `/api/v1/chat/sessions` | 챗봇 세션 생성 | 대기중 |
| V1 | GET | `/api/v1/chat/sessions/{session_id}/messages` | 세션 메시지 목록 조회 | 대기중 |
| V1 | POST | `/api/v1/chat/sessions/{session_id}/messages` | 세션 메시지 전송/응답 | 대기중 |
| V1 | POST | `/api/v1/chat/sessions/{session_id}/stream` | 세션 메시지 스트리밍 응답 | 대기중 |
| V1 | DELETE | `/api/v1/chat/sessions/{session_id}` | 챗봇 세션 삭제 | 대기중 |
| V1 | GET | `/api/v1/notifications` | 알림 목록 조회 | 대기중 |
| V1 | GET | `/api/v1/notifications/unread-count` | 미읽음 알림 개수 조회 | 대기중 |
| V1 | PATCH | `/api/v1/notifications/{notification_id}/read` | 알림 단건 읽음 처리 | 대기중 |
| V1 | PATCH | `/api/v1/notifications/read-all` | 알림 전체 읽음 처리 | 대기중 |
| V1 | POST | `/api/v1/reminders` | 복약 리마인더 생성 | 대기중 |
| V1 | GET | `/api/v1/reminders` | 복약 리마인더 조회 | 대기중 |
| V1 | PATCH | `/api/v1/reminders/{reminder_id}` | 복약 리마인더 수정 | 대기중 |
| V1 | DELETE | `/api/v1/reminders/{reminder_id}` | 복약 리마인더 삭제 | 대기중 |
| V1 | GET | `/api/v1/reminders/medication-dday` | 약 소진 D-day 조회 | 대기중 |

### 12.9 요구사항 기반 미등록 API 갭 (2026-02-27)

- 기준: `요구사항_정의서.xlsx`, `API_명세서.xlsx`
- 현재 기준 미등록 API 갭 없음 (`REQ-010` schedules API, `REQ-005`, `REQ-008`, `REQ-014`, `REQ-015` 관련 응답 스키마 반영 완료).
