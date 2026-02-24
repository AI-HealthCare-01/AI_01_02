# AI Health Project API 명세서

문서 버전: v1.7  
작성일: 2026-02-24  
원본: `docs/REQUIREMENTS_DEFINITION.md`의 기존 섹션 11~12  
문서 목적: 객체 모델 명세와 API 계약 명세를 독립 문서로 관리한다.
문서 변경 이력:
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

정책 메모:
- 현재 구현(v1) 실패 응답은 FastAPI 기본 형식(`{"detail":"..."}`)을 사용한다.
- `ApiError` 객체 표준화는 목표 계약이며, 점진 반영한다.

### 11.2 인증/사용자 객체

| 객체명 | 필드 | 타입 | 필수/선택 | 설명 |
|---|---|---|---|---|
| SignUpRequest | email | string(email) | 필수 | 로그인 ID |
| SignUpRequest | password | string | 필수 | 비밀번호 정책 충족 |
| SignUpRequest | name | string | 필수 | 실명 |
| SignUpRequest | gender | enum(`MALE`,`FEMALE`) | 필수 | 성별 |
| SignUpRequest | birth_date | string(date) | 필수 | 생년월일 |
| SignUpRequest | phone_number | string | 필수 | 휴대폰 번호 |
| SignUpRequest | nickname | string | 선택 | 별칭 |
| LoginRequest | email | string(email) | 필수 | 로그인 ID |
| LoginRequest | password | string | 필수 | 비밀번호 |
| LoginResponse | access_token | string | 필수 | JWT access token |
| LoginResponse | token_type | string | 선택 | 기본 `Bearer` |
| LoginResponse | expires_in | int | 선택 | access token 만료(초) |
| UserInfo | id | int | 필수 | 사용자 ID |
| UserInfo | name | string | 필수 | 이름 |
| UserInfo | email | string | 필수 | 이메일 |
| UserInfo | phone_number | string | 필수 | 휴대폰 번호 |
| UserInfo | birthday | string(date) | 필수 | 생년월일 |
| UserInfo | gender | enum | 필수 | 성별 |
| UserInfo | created_at | string(datetime) | 필수 | 가입시각 |
| UserUpdateRequest | name/email/phone_number/birthday/gender | mixed | 선택 | 부분 업데이트(PATCH) |

### 11.3 건강 프로필 객체 (신규)

| 객체명 | 필드 | 타입 | 필수/선택 | 설명 |
|---|---|---|---|---|
| HealthProfileUpsertRequest | basic_info | object | 필수 | 신체 기초 정보 |
| HealthProfileUpsertRequest | medical_history | object | 선택 | 병력/수술/알러지 |
| HealthProfileUpsertRequest | lifestyle_input | object | 선택 | 운동/디지털/기호품 |
| HealthProfileUpsertRequest | sleep_input | object | 선택 | 수면 패턴 |
| HealthProfileUpsertRequest | nutrition_input | object | 선택 | 영양/식사 정보 |
| HealthProfile | id/user_id | mixed | 필수 | 건강 프로필 식별자 |
| HealthProfile | basic_info/medical_history/lifestyle_input/sleep_input/nutrition_input | object | 필수 | 저장된 프로필 입력 구조 |
| HealthProfile | created_at/updated_at | string(datetime) | 필수 | 생성/수정 시각 |
| basic_info | height_cm | float | 필수 | 키(cm) |
| basic_info | weight_kg | float | 필수 | 체중(kg) |
| medical_history | underlying_diseases | string[] | 선택 | 기저질환 |
| medical_history | psychiatric_diseases | string[] | 선택 | 정신과 병력 |
| medical_history | surgical_history | string[] | 선택 | 수술 이력 |
| medical_history | drug_allergies | string[] | 선택 | 약물 알러지 |
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
| OcrDocument | id | int | 필수 | 업로드 문서 ID |
| OcrDocument | document_type | enum | 필수 | 문서 타입 |
| OcrDocument | file_name | string | 필수 | 업로드 파일명 |
| OcrDocument | file_path | string | 선택 | 현재 구현 응답에 포함되는 저장 상대경로 |
| OcrDocument | mime_type | string | 필수 | 파일 MIME 타입 |
| OcrDocument | file_size | int | 필수 | 파일 크기(byte) |
| OcrDocument | uploaded_at | string(datetime) | 필수 | 업로드 시각 |
| OcrDocumentUploadRequest | document_type | enum | 필수 | 문서 타입 |
| OcrDocumentUploadRequest | file | file | 필수 | 업로드 파일 |
| OcrJobCreateRequest | document_id | int | 필수 | OCR 대상 문서 ID |
| OcrJobStatus | job_id | int | 필수 | OCR job ID |
| OcrJobStatus | status | enum(`QUEUED`,`PROCESSING`,`SUCCEEDED`,`FAILED`) | 필수 | 상태 |
| OcrJobStatus | retry_count/max_retries | int | 필수 | 재시도 정보 |
| OcrJobStatus | failure_code/error_message | string \| null | 선택(nullable) | 실패 정보 |
| OcrJobStatus | queued_at/started_at/completed_at | string(datetime) \| null | 선택(nullable) | 작업 시각 메타데이터 |
| OcrJobResult | job_id | int | 필수 | OCR job ID |
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
| OcrResult(계획) | raw_blocks | OcrRawBlock[] | 선택 | 블록 정보(저신뢰/사용자 검토 케이스 우선 저장) |
| OcrResult(계획) | extracted_medications | OcrMedicationItem[] | 필수 | 구조화 약물 결과 |
| OcrResult(계획) | overall_confidence | float | 선택 | 전체 신뢰도 |
| OcrResult(계획) | needs_user_review | bool | 필수 | 사용자 검토 필요 여부 |
| OcrReviewConfirmRequest | confirmed | bool | 필수 | 자동 인식 결과 확정 여부 |
| OcrReviewConfirmRequest | corrected_medications | OcrMedicationItem[] | 선택 | 사용자 수정값 |
| OcrReviewConfirmRequest | comment | string | 선택 | 수정 사유/메모 |

### 11.5 가이드/분석 객체

| 객체명 | 필드 | 타입 | 필수/선택 | 설명 |
|---|---|---|---|---|
| GuideJobStatus | job_id | int | 필수 | 가이드 job ID |
| GuideJobStatus | status | enum(`QUEUED`,`PROCESSING`,`SUCCEEDED`,`FAILED`) | 필수 | 상태 |
| GuideJobStatus | retry_count/max_retries | int | 필수 | 재시도 정보 |
| GuideJobStatus | failure_code/error_message | string \| null | 선택(nullable) | 실패 정보 |
| GuideJobStatus | queued_at/started_at/completed_at | string(datetime) \| null | 선택(nullable) | 작업 시각 메타데이터 |
| GuideJobCreateRequest | ocr_job_id | int | 필수 | 가이드 원천 OCR job |
| GuideJobResult | job_id | int | 필수 | 가이드 job ID |
| GuideJobResult | medication_guidance/lifestyle_guidance | string | 필수 | 베이스라인 가이드 텍스트 |
| GuideJobResult | risk_level | enum(`LOW`,`MEDIUM`,`HIGH`) | 필수 | 가이드 위험도 |
| GuideJobResult | safety_notice | string | 필수 | 의료진 상담 고지 |
| GuideJobResult | structured_data | object | 필수 | 생성 메타데이터(JSON) |
| GuideJobResult | created_at/updated_at | string(datetime) | 필수 | 결과 생성/수정 시각 |
| GuideResult(계획) | medication_guide | object | 필수 | 복약 안내 |
| GuideResult(계획) | health_coaching | object | 필수 | 생활습관 코칭 |
| GuideResult(계획) | risk_flags | object | 필수 | 위험 플래그 |
| GuideResult(계획) | safety_notice | string | 필수 | 의료진 상담 고지 |
| AnalysisSummary | basic_info/lifestyle_analysis/sleep_analysis/nutrition_analysis | object | 필수 | 지표 분석 결과 |

### 11.6 챗봇 객체

| 객체명 | 필드 | 타입 | 필수/선택 | 설명 |
|---|---|---|---|---|
| ChatSessionCreateRequest | title | string | 선택 | 세션 제목 |
| ChatSession | id | int | 필수 | 세션 ID |
| ChatSession | status | enum(`ACTIVE`,`CLOSED`) | 필수 | 세션 상태 |
| ChatSession | last_activity_at | string(datetime) | 선택 | 마지막 활동 시각 |
| ChatSession | auto_close_after_minutes | int | 선택 | 자동 종료 기준(분) |
| ChatMessageSendRequest | message | string | 필수 | 사용자 질문 |
| ChatMessageSendRequest | stream | bool | 선택 | SSE 여부(기본 true) |
| ChatReference | document_id | string \| int | 필수 | 근거 문서 식별자 |
| ChatReference | title | string | 필수 | 근거 문서 제목 |
| ChatReference | source | string | 필수 | 출처명(기관/사이트) |
| ChatReference | url | string | 선택 | 근거 링크 |
| ChatReference | score | float | 선택 | 검색 유사도/랭킹 점수 |
| ChatMessage | id | int | 필수 | 메시지 ID |
| ChatMessage | role | enum(`USER`,`ASSISTANT`,`SYSTEM`) | 필수 | 역할 |
| ChatMessage | content | string | 필수 | 메시지 본문 |
| ChatMessage | references | ChatReference[] | 선택 | RAG 근거 문서(근거가 있을 때만 포함) |
| ChatMessage | needs_clarification | bool | 선택 | 저유사도 질의로 재질문 유도 여부 |
| ChatStreamEvent | event | string | 필수 | `token`, `reference`, `done`, `error` |
| ChatStreamEvent | data | object | 필수 | 이벤트 payload |

### 11.7 알림/리마인더 객체

| 객체명 | 필드 | 타입 | 필수/선택 | 설명 |
|---|---|---|---|---|
| Notification | id/type/title/message/is_read/created_at | mixed | 필수 | 알림 기본 필드 |
| Notification | read_at/payload | mixed | 선택(nullable) | 읽음 시각/부가정보 |
| MedicationReminderUpsertRequest | medication_name | string | 필수 | 약물명 |
| MedicationReminderUpsertRequest | dose | string | 선택 | 복용량 텍스트 |
| MedicationReminderUpsertRequest | schedule_times | string[](`HH:MM`) | 필수 | 알림 시각 배열 |
| MedicationReminderUpsertRequest | start_date/end_date | string(date) | 선택 | 적용 기간 |
| MedicationReminderUpsertRequest | enabled | bool | 선택 | 알림 활성화 |
| Reminder | id | int | 필수 | 리마인더 ID |
| Reminder | medication_name | string | 필수 | 약물명 |
| Reminder | dose | string | 선택 | 복용량 텍스트 |
| Reminder | schedule_times | string[](`HH:MM`) | 필수 | 알림 시각 배열 |
| Reminder | start_date/end_date | string(date) \| null | 선택(nullable) | 적용 기간 |
| Reminder | enabled | bool | 필수 | 활성화 여부 |
| Reminder | created_at/updated_at | string(datetime) | 필수 | 생성/수정 시각 |
| DdayReminder | medication_name | string | 필수 | 약물명 |
| DdayReminder | remaining_days | int | 필수 | 소진까지 남은 일수 |
| DdayReminder | estimated_depletion_date | string(date) | 필수 | 소진 예상일 |

## 12. API 계약 명세 (Request/Response)

### 12.1 공통 규칙

- 인증: 보호 API는 `Authorization: Bearer <access_token>` 필수
- Content-Type:
  - JSON API: `application/json`
  - 파일 업로드: `multipart/form-data`
  - 스트리밍: `text/event-stream`
- 성공 응답: HTTP 표준코드 + 객체 본문
- 실패 응답(현재 구현): FastAPI 기본 오류 객체 `{"detail":"..."}` 중심
- 실패 응답(목표 계약): `ApiError` 객체 표준화

### 12.2 인증/사용자 API

| Method | Path | 상태 | Request (필수/선택) | Success Response |
|---|---|---|---|---|
| POST | `/api/v1/auth/signup` | 구현 | `SignUpRequest` (필수: `email,password,name,gender,birth_date,phone_number`) | `201 {"detail":"회원가입이 성공적으로 완료되었습니다."}` |
| POST | `/api/v1/auth/login` | 구현 | `LoginRequest` (필수: `email,password`) | `200 LoginResponse` + `refresh_token` 쿠키 |
| GET | `/api/v1/auth/token/refresh` | 구현 | 쿠키 `refresh_token` (필수) | `200 {"access_token":"..."}` |
| GET | `/api/v1/users/me` | 구현 | 없음 | `200 UserInfo` |
| PATCH | `/api/v1/users/me` | 구현 | `UserUpdateRequest` (모든 필드 선택) | `200 UserInfo` |
| PUT | `/api/v1/profiles/health` | 계획 | `HealthProfileUpsertRequest` (`basic_info` 필수) | `200 HealthProfile` |
| GET | `/api/v1/profiles/health` | 계획 | 없음 | `200 HealthProfile` |

### 12.3 OCR/가이드 API

| Method | Path | 상태 | Request (필수/선택) | Success Response |
|---|---|---|---|---|
| POST | `/api/v1/ocr/documents/upload` | 구현 | multipart: `document_type`(필수), `file`(필수) | `201 OcrDocument` |
| POST | `/api/v1/ocr/jobs` | 구현 | `{"document_id": int}` (필수) | `202 OcrJobStatus` |
| GET | `/api/v1/ocr/jobs/{job_id}` | 구현 | path `job_id`(필수) | `200 OcrJobStatus` |
| GET | `/api/v1/ocr/jobs/{job_id}/result` | 구현 | path `job_id`(필수) | `200 OcrJobResult` |
| PATCH | `/api/v1/ocr/jobs/{job_id}/confirm` | 계획 | `OcrReviewConfirmRequest` (`confirmed` 필수) | `200 OcrResult(계획)` |
| POST | `/api/v1/guides/jobs` | 구현 | `{"ocr_job_id": int}` (필수) | `202 GuideJobStatus` |
| GET | `/api/v1/guides/jobs/{job_id}` | 구현 | path `job_id`(필수) | `200 GuideJobStatus` |
| GET | `/api/v1/guides/jobs/{job_id}/result` | 구현 | path `job_id`(필수) | `200 GuideJobResult` |
| GET | `/api/v1/analysis/summary` | 계획 | query: `date_from,date_to`(선택) | `200 AnalysisSummary` |

정책 메모:
- OCR/파싱 완료 후 원본 업로드 이미지는 즉시 폐기하며, DB/클라우드 스토리지에 파일 형태로 보관하지 않는다 (`REQ-127`).
- OCR/가이드 작업 생성 시 큐 등록 실패가 발생하면 서버는 `503`을 반환하고 해당 job을 `FAILED`로 마킹한다(고착 방지).
- OCR 블록 좌표(`raw_blocks`)는 필수 영속 저장 대상이 아니며, 저신뢰/검수 필요 케이스 중심으로 선택 저장할 수 있다.

### 12.4 챗봇 API

| Method | Path | 상태 | Request (필수/선택) | Success Response |
|---|---|---|---|---|
| POST | `/api/v1/chat/sessions` | 계획 | `{"title": string}` (선택) | `201 ChatSession` |
| GET | `/api/v1/chat/sessions/{session_id}/messages` | 계획 | path `session_id`(필수), query `limit,offset`(선택) | `200 {"items": ChatMessage[], "meta": PaginationMeta}` |
| POST | `/api/v1/chat/sessions/{session_id}/messages` | 계획 | `ChatMessageSendRequest` (`message` 필수, `stream` 선택) | `200 ChatMessage` |
| POST | `/api/v1/chat/sessions/{session_id}/stream` | 계획 | `ChatMessageSendRequest` (`message` 필수) | `200 text/event-stream (ChatStreamEvent)` |

정책 메모:
- 검색 유사도가 임계값 미만이면 `needs_clarification=true` 메시지로 재질문을 유도할 수 있다 (`REQ-060`).
- 세션은 비활성 10~30분 경과 시 자동 `CLOSED` 처리될 수 있다 (`REQ-061`).

### 12.5 알림/리마인더 API

| Method | Path | 상태 | Request (필수/선택) | Success Response |
|---|---|---|---|---|
| GET | `/api/v1/notifications` | 구현 | query `limit,offset,is_read`(선택) | `200 {"items": Notification[], "unread_count": int}` |
| GET | `/api/v1/notifications/unread-count` | 구현 | 없음 | `200 {"unread_count": int}` |
| PATCH | `/api/v1/notifications/{notification_id}/read` | 구현 | path `notification_id`(필수) | `200 Notification` |
| PATCH | `/api/v1/notifications/read-all` | 구현 | 없음 | `200 {"updated_count": int}` |
| GET | `/api/v2/notifications/capabilities` | 구현 | 없음 | `200 {"version":"v2","status":"planned","features":[string...]}` |
| POST | `/api/v1/reminders` | 계획 | `MedicationReminderUpsertRequest` (`medication_name,schedule_times` 필수) | `201 Reminder` |
| GET | `/api/v1/reminders` | 계획 | query `enabled`(선택) | `200 {"items": Reminder[]}` |
| PATCH | `/api/v1/reminders/{reminder_id}` | 계획 | `MedicationReminderUpsertRequest` (모든 필드 선택) | `200 Reminder` |
| DELETE | `/api/v1/reminders/{reminder_id}` | 계획 | path `reminder_id`(필수) | `204` |
| GET | `/api/v1/reminders/medication-dday` | 계획 | query `days`(선택, 기본 7) | `200 {"items": DdayReminder[]}` |

### 12.6 개발/운영 지원 API

| Method | Path | 상태 | Request (필수/선택) | Success Response |
|---|---|---|---|---|
| GET | `/api/v1/dev/notifications-playground` | 구현 | 없음(내부 지원 API) | `200 text/html` |

정책 메모:
- `/api/v1/dev/*` 경로는 팀 내 테스트/데모 목적의 내부 지원 API로 운영한다.
- `/api/docs`, `/api/redoc`, `/api/openapi.json`은 FastAPI 기본 문서 라우트로 별도 계약 표에서 제외한다.

### 12.7 대표 에러 코드 매핑

정책 메모:
- 현재 구현(v1) 다수 엔드포인트는 `detail` 문자열 기반 오류 응답을 사용한다.
- 아래 `code` 매핑은 표준화 목표 코드이며, 구현 범위에 따라 단계적으로 반영한다.

| HTTP | code 예시 | 발생 상황 |
|---|---|---|
| 400 | `VALIDATION_ERROR` | 필수 필드 누락, 형식 오류 |
| 401 | `AUTH_INVALID_TOKEN` | 토큰 누락/만료 |
| 403 | `AUTH_FORBIDDEN` | 권한 없는 리소스 접근 |
| 404 | `RESOURCE_NOT_FOUND` | 대상 리소스 없음 |
| 409 | `STATE_CONFLICT` | 처리 상태 미충족(예: OCR 미완료 상태에서 가이드 요청) |
| 413 | `FILE_TOO_LARGE` | 파일 크기 제한 초과 |
| 422 | `OCR_LOW_CONFIDENCE` | OCR 신뢰도 임계값 미달 |
| 429 | `RATE_LIMITED` | 요청 과다 |
| 503 | `QUEUE_UNAVAILABLE` | 비동기 작업 큐 등록 실패(서비스 일시 불가) |
| 500 | `INTERNAL_ERROR` | 서버 내부 오류 |
| 502 | `UPSTREAM_OCR_ERROR` | 외부 OCR API 실패 |
| 504 | `UPSTREAM_TIMEOUT` | 외부 LLM/OCR 타임아웃 |
