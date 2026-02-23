# AI Health Project API 명세서

문서 버전: v1.2  
작성일: 2026-02-23  
원본: `docs/REQUIREMENTS_DEFINITION.md`의 기존 섹션 11~12  
문서 목적: 객체 모델 명세와 API 계약 명세를 독립 문서로 관리한다.
문서 변경 이력:
- v1.2 (2026-02-23): 챗봇/이미지분석/OCR 계약 정합성 보강(출처 객체, 저유사도 재질문 플래그, 자동 세션 종료 메타, 알약 다중객체/품질 실패 상태, OCR 원본 이미지 폐기 정책 명시)
- v1.1 (2026-02-23): REQ-064 반영(이미지분석 오분류 신고 객체 및 API 계약 추가)

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
| OcrRawBlock | text | string | 필수 | OCR 원문 블록 |
| OcrRawBlock | bbox | number[] | 필수 | 좌표 |
| OcrRawBlock | confidence | float | 선택 | OCR 블록 신뢰도 |
| OcrMedicationItem | drug_name | string | 필수 | 약물명 |
| OcrMedicationItem | dose | float | 선택 | 용량 |
| OcrMedicationItem | frequency_per_day | int | 선택 | 1일 복용 횟수 |
| OcrMedicationItem | dosage_per_once | int | 선택 | 1회 복용 개수 |
| OcrMedicationItem | intake_time | enum | 선택 | 복용 시점(`morning/lunch/dinner/bedtime/PRN`) |
| OcrMedicationItem | administration_timing | enum | 선택 | 식전/식후 규칙 |
| OcrMedicationItem | dispensed_date | string(date) | 선택 | 조제일 |
| OcrMedicationItem | total_days | int | 선택 | 총 처방일 |
| OcrMedicationItem | confidence | float | 선택 | 필드 신뢰도 |
| OcrResult | raw_text | string | 필수 | OCR 원문 |
| OcrResult | raw_blocks | OcrRawBlock[] | 선택 | 블록 정보 |
| OcrResult | extracted_medications | OcrMedicationItem[] | 필수 | 구조화 약물 결과 |
| OcrResult | overall_confidence | float | 선택 | 전체 신뢰도 |
| OcrResult | needs_user_review | bool | 필수 | 사용자 검토 필요 여부 |
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
| GuideResult | medication_guide | object | 필수 | 복약 안내 |
| GuideResult | health_coaching | object | 필수 | 생활습관 코칭 |
| GuideResult | risk_flags | object | 필수 | 위험 플래그 |
| GuideResult | safety_notice | string | 필수 | 의료진 상담 고지 |
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

### 11.7 알림/리마인더/이미지분석 객체

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
| PillAnalysisRequest | image | file | 필수 | 알약 이미지 |
| PillAnalysisResult | analysis_id | int | 필수 | 분석 ID |
| PillAnalysisResult | status | enum(`QUEUED`,`PROCESSING`,`SUCCEEDED`,`UNREADABLE`,`OOD`,`MULTI_OBJECT`,`FAILED`) | 필수 | 판독 상태 |
| PillAnalysisResult | predicted_drug_id/predicted_drug_name | mixed | 선택 | 예측 약물 |
| PillAnalysisResult | confidence | float | 선택 | 예측 신뢰도 |
| PillAnalysisResult | detected_object_count | int | 선택 | 감지된 알약 객체 수 |
| PillAnalysisResult | rejection_reason | enum(`LOW_CONFIDENCE`,`BLUR`,`CROPPED`,`OOD`,`MULTI_OBJECT`) | 선택 | 판독불가/중단 사유 |
| PillAnalysisResult | message | string | 선택 | 사용자 안내 문구 |
| PillAnalysisResult | guidance | object | 선택 | 복약 가이드 매핑 |
| PillMisclassificationReportRequest | correct_drug_id | int | 선택 | 내부 약물 사전에서 선택한 올바른 약물 ID |
| PillMisclassificationReportRequest | correct_drug_name | string | 선택 | 내부 사전에 없는 경우 사용자가 입력한 약물명 |
| PillMisclassificationReportRequest | reason | string | 선택 | 오분류 신고 사유 |
| PillMisclassificationReportRequest | comment | string | 선택 | 추가 메모 |
| PillMisclassificationReport | report_id | int | 필수 | 오분류 신고 ID |
| PillMisclassificationReport | analysis_id | int | 필수 | 대상 분석 ID |
| PillMisclassificationReport | status | enum(`RECEIVED`,`REVIEWED`,`REFLECTED`,`REJECTED`) | 필수 | 신고 처리 상태 |
| PillMisclassificationReport | corrected_drug_id/corrected_drug_name | mixed | 선택 | 신고된 정답 약물 정보 |
| PillMisclassificationReport | created_at | string(datetime) | 필수 | 신고 생성 시각 |

## 12. API 계약 명세 (Request/Response)

### 12.1 공통 규칙

- 인증: 보호 API는 `Authorization: Bearer <access_token>` 필수
- Content-Type:
  - JSON API: `application/json`
  - 파일 업로드: `multipart/form-data`
  - 스트리밍: `text/event-stream`
- 성공 응답: HTTP 표준코드 + 객체 본문
- 실패 응답: `ApiError` 객체

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
| GET | `/api/v1/ocr/jobs/{job_id}/result` | 구현 | path `job_id`(필수) | `200 OcrResult` |
| PATCH | `/api/v1/ocr/jobs/{job_id}/confirm` | 계획 | `OcrReviewConfirmRequest` (`confirmed` 필수) | `200 OcrResult` |
| POST | `/api/v1/guides/jobs` | 구현 | `{"ocr_job_id": int}` (필수) | `202 GuideJobStatus` |
| GET | `/api/v1/guides/jobs/{job_id}` | 구현 | path `job_id`(필수) | `200 GuideJobStatus` |
| GET | `/api/v1/guides/jobs/{job_id}/result` | 구현 | path `job_id`(필수) | `200 GuideResult` |
| GET | `/api/v1/analysis/summary` | 계획 | query: `date_from,date_to`(선택) | `200 AnalysisSummary` |

정책 메모:
- OCR/파싱 완료 후 원본 업로드 이미지는 즉시 폐기하며, DB/클라우드 스토리지에 파일 형태로 보관하지 않는다 (`REQ-127`).

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

### 12.5 이미지분석 API

| Method | Path | 상태 | Request (필수/선택) | Success Response |
|---|---|---|---|---|
| POST | `/api/v1/pill-analysis` | 계획 | multipart: `image`(필수) | `202 {"analysis_id": int, "status":"QUEUED"}` |
| GET | `/api/v1/pill-analysis/{analysis_id}` | 계획 | path `analysis_id`(필수) | `200 PillAnalysisResult` |
| POST | `/api/v1/pill-analysis/{analysis_id}/misclassifications` | 계획 | path `analysis_id`(필수), `PillMisclassificationReportRequest` (`correct_drug_id` 또는 `correct_drug_name` 중 1개 필수) | `202 PillMisclassificationReport` |

정책 메모:
- 다중 알약 감지 시 `status=MULTI_OBJECT`로 처리하고 재촬영 안내 메시지를 반환한다 (`REQ-063`).
- 확률 임계값 미달/품질불량/OOD는 `UNREADABLE` 또는 `OOD` 상태로 반환한다 (`REQ-036`).

### 12.6 알림/리마인더 API

| Method | Path | 상태 | Request (필수/선택) | Success Response |
|---|---|---|---|---|
| GET | `/api/v1/notifications` | 구현 | query `limit,offset,is_read`(선택) | `200 {"items": Notification[], "unread_count": int}` |
| GET | `/api/v1/notifications/unread-count` | 구현 | 없음 | `200 {"unread_count": int}` |
| PATCH | `/api/v1/notifications/{notification_id}/read` | 구현 | path `notification_id`(필수) | `200 Notification` |
| PATCH | `/api/v1/notifications/read-all` | 구현 | 없음 | `200 {"updated_count": int}` |
| POST | `/api/v1/reminders` | 계획 | `MedicationReminderUpsertRequest` (`medication_name,schedule_times` 필수) | `201 Reminder` |
| GET | `/api/v1/reminders` | 계획 | query `enabled`(선택) | `200 {"items": Reminder[]}` |
| PATCH | `/api/v1/reminders/{reminder_id}` | 계획 | `MedicationReminderUpsertRequest` (모든 필드 선택) | `200 Reminder` |
| DELETE | `/api/v1/reminders/{reminder_id}` | 계획 | path `reminder_id`(필수) | `204` |
| GET | `/api/v1/reminders/medication-dday` | 계획 | query `days`(선택, 기본 7) | `200 {"items": DdayReminder[]}` |

### 12.7 대표 에러 코드 매핑

| HTTP | code 예시 | 발생 상황 |
|---|---|---|
| 400 | `VALIDATION_ERROR` | 필수 필드 누락, 형식 오류 |
| 401 | `AUTH_INVALID_TOKEN` | 토큰 누락/만료 |
| 403 | `AUTH_FORBIDDEN` | 권한 없는 리소스 접근 |
| 404 | `RESOURCE_NOT_FOUND` | 대상 리소스 없음 |
| 409 | `STATE_CONFLICT` | 처리 상태 미충족(예: OCR 미완료 상태에서 가이드 요청) |
| 413 | `FILE_TOO_LARGE` | 파일 크기 제한 초과 |
| 422 | `OCR_LOW_CONFIDENCE` | OCR 신뢰도 임계값 미달 |
| 422 | `PILL_MULTI_OBJECT` | 이미지에서 복수 알약 감지 |
| 422 | `PILL_UNREADABLE` | 흐림/잘림/저품질 등으로 판독 불가 |
| 429 | `RATE_LIMITED` | 요청 과다 |
| 500 | `INTERNAL_ERROR` | 서버 내부 오류 |
| 502 | `UPSTREAM_OCR_ERROR` | 외부 OCR API 실패 |
| 504 | `UPSTREAM_TIMEOUT` | 외부 LLM/OCR 타임아웃 |
