# AI Health Project 팀 개발 가이드라인

문서 버전: v2.28  
작성일: 2026-02-27  
기준 문서:
- `docs/REQUIREMENTS_DEFINITION.md` (v1.28)
- `docs/API_SPECIFICATION.md` (v1.33)
- `docs/요구사항_정의서.xlsx`
- `docs/API_명세서.xlsx`

문서 변경 이력:
- v2.28 (2026-02-27): 최신 `API_명세서.xlsx`(36건) 반영으로 schedules API를 가이드 기능 범위에 편입하고 API 상태 표기를 명세 기준으로 정리
- v2.27 (2026-02-27): 비기능 요구사항 ID 재번호화(`REQ-101~REQ-128`) 반영에 맞춰 REQ 참조와 기준 문서 버전(v1.28/v1.32)을 동기화
- v2.26 (2026-02-27): 기준 문서 버전을 `REQUIREMENTS_DEFINITION.md` v1.27, `API_SPECIFICATION.md` v1.31로 재동기화
- v2.25 (2026-02-27): 기준 API 명세 문서 버전을 `API_SPECIFICATION.md` v1.30으로 갱신하고 문서 간 교차참조를 최신화
- v2.24 (2026-02-27): 최신 요구사항 체계(기능 `REQ-001~REQ-062`, 비기능 `REQ-101~REQ-128`) 반영으로 기능군/우선순위/운영 기준의 REQ 참조를 재매핑하고 기준 문서 버전을 동기화
- v2.23 (2026-02-27): 챗봇 메시지 상태 추적(`status/last_token_seq/updated_at`)과 스트리밍 이탈 시 자동 중단 후 재전송 원칙을 개발/검수 기준에 반영
- v2.22 (2026-02-27): 기준 문서 버전을 `REQUIREMENTS_DEFINITION.md` v1.25, `API_SPECIFICATION.md` v1.27로 갱신하고 최신 문서 동기화 기준을 반영
- v2.21 (2026-02-27): 최신 `API_명세서.xlsx`(34건) 기준으로 회원 탈퇴/챗봇 세션 삭제 API를 재반영하고 삭제 정책 안내를 동기화
- v2.20 (2026-02-27): 최신 `API_명세서.xlsx`(32건) 기준으로 삭제 API 미등록 상태를 반영해 챗봇/인증 API 목록을 정리하고 기준 API 문서 버전을 갱신
- v2.19 (2026-02-27): 기준 문서 버전을 `REQUIREMENTS_DEFINITION.md` v1.24, `API_SPECIFICATION.md` v1.23으로 동기화하고 보호자 기능 범위 제외 정책을 반영
- v2.18 (2026-02-27): 회원 탈퇴 기준을 소프트 삭제(`is_active=false`) + 토큰 즉시 무효화로 명확화하고 보안/인증 운영 기준을 동기화
- v2.17 (2026-02-27): 최신 `요구사항_정의서.xlsx`(86건) 기준으로 기능군 REQ 매핑을 재정렬하고 챗봇 삭제 API를 세션 삭제 단일 경로로 동기화
- v2.16 (2026-02-27): 최신 요구사항 정의서(v1.21, 84건) 기준으로 회원 탈퇴/챗봇 삭제 관련 REQ 참조를 정리하고 API 계획 항목 표기를 보정
- v2.15 (2026-02-27): 챗봇 대화기록 삭제 요구사항과 계획 삭제 API를 반영해 챗봇 개발/검수 기준을 동기화
- v2.14 (2026-02-27): 회원 탈퇴 요구사항과 `DELETE /api/v1/users/me` 계획 API를 반영해 인증 경로/우선순위/보안 기준을 동기화
- v2.13 (2026-02-27): 최신 기준문서 버전(v1.18/v1.16) 반영 및 API_명세서 기준 범위를 벗어나는 내부 전용 API 안내 섹션 제거
- v2.12 (2026-02-27): 산출물 원본 파일명 변경(`요구사항_정의서.xlsx`, `API_명세서.xlsx`)을 반영하고 기준 문서 버전을 동기화
- v2.11 (2026-02-27): 최신 요구사항(v1.16/xlsx) 기준으로 기능군별 REQ 매핑, 공통 비기능 기준, 우선순위/DoD 참조를 전면 동기화
- v2.10 (2026-02-26): 전수 정합성 점검 반영(삭제된 문서 참조 정리, 기준 문서 버전 업데이트, 내부 지원 API 목록 표기 정리)
- v2.9 (2026-02-26): 최신 요구사항/API/엑셀 명세 동기화(REQ-001~085 체계 반영, 챗봇 프롬프트/약물 자동완성/가이드 갱신 계획 API 반영, 계약 외 내부 API 구분 명시)
- v2.8 (2026-02-26): API 명세 v1.11 동기화 반영(`/users/me` Bearer 인증 명시, 외부 식별자 string 계약 반영)
- v2.7 (2026-02-24): API 명세 v1.8 동기화 반영(작업 생성 응답 객체/로그인 응답 필드 정합화)
- v2.6 (2026-02-24): 구현 API 실사 정합화 반영(알림 v2 capability 조회, dev 알림 플레이그라운드 내부 API 명시)
- v2.5 (2026-02-24): OCR 원본 폐기 경로(큐 실패 포함) 및 raw blocks 선택 저장 정책 동기화
- v2.4 (2026-02-24): API 명세 v1.5 동기화 반영(작업 생성 큐 실패 처리 정책 정합화)
- v2.3 (2026-02-24): API 명세 v1.4 동기화 반영(구현 응답 스키마/오류 응답 메모 정합화)
- v2.2 (2026-02-24): `알약 이미지 분류 기반 복약 분석` 기능 제외 반영
- v2.1 (2026-02-23): API 명세 v1.2 동기화 반영
- v2.0 (2026-02-23): 5대 주요 구현 기능 중심으로 전면 개편
- v1.0 (2026-02-23): 초기 팀 가이드 작성

## 1. 문서 목적

이 문서는 팀원이 동일한 기준으로 개발/리뷰/검수하기 위한 실행 기준서다.  
요구사항 정의서 내용을 실제 개발 단위(기능, API, 데이터, 테스트, 운영)로 연결한다.

## 2. 프로젝트 핵심 구현 기능

본 프로젝트의 주요 구현 기능은 아래 4가지다.

1. LLM 기반 안내 가이드 생성
2. 실시간 챗봇
3. OCR 기반 의료정보 인식
4. 알림 기능

## 3. 기능별 한눈에 보기

| 기능 | 핵심 목표 | 주요 요구사항 ID | 핵심 API(명세 기준) | 현재 상태 |
|---|---|---|---|---|
| 1. LLM 기반 안내 가이드 생성 | 프로필+처방+지식을 결합한 개인화 복약/생활 가이드 | REQ-001~010, REQ-012~015, REQ-045~049 | `POST /api/v1/guides/jobs`, `GET /api/v1/guides/jobs/{job_id}`, `GET /api/v1/guides/jobs/{job_id}/result`, `POST /api/v1/guides/jobs/{job_id}/refresh`, `GET /api/v1/analysis/summary`, `GET /api/v1/schedules/daily`, `PATCH /api/v1/schedules/items/{item_id}/status` | 대기중 (명세 기준) |
| 2. 실시간 챗봇 | 안전 가드레일 + 하이브리드 검색 + SSE 스트리밍 | REQ-029~044 | `GET /api/v1/chat/prompt-options`, `POST /api/v1/chat/sessions`, `DELETE /api/v1/chat/sessions/{session_id}`, `POST /api/v1/chat/sessions/{session_id}/stream` | 대기중 (명세 기준) |
| 3. OCR 기반 의료정보 인식 | 처방/약봉투 텍스트 구조화 + 신뢰도 검증 + 사용자 확인 | REQ-050~062 | `POST /api/v1/ocr/documents/upload`, `POST /api/v1/ocr/jobs`, `GET /api/v1/ocr/jobs/{job_id}/result`, `PATCH /api/v1/ocr/jobs/{job_id}/confirm`, `GET /api/v1/medications/search` | 대기중 (명세 기준) |
| 4. 알림 기능 | 가이드 완료/읽음 처리/리마인더/D-day 안내 | REQ-016~021 | `GET/PATCH /api/v1/notifications*`, `POST/GET/PATCH/DELETE /api/v1/reminders*`, `GET /api/v1/reminders/medication-dday` | 대기중 (명세 기준) |

## 4. 전체 서비스 흐름 (E2E)

1. 사용자 인증(회원가입/로그인/회원 탈퇴)
2. 건강 프로필 입력
3. 의료문서 업로드
4. OCR -> 파싱/정제 -> 신뢰도 검증
5. 사용자 확인/수정(저신뢰 시, 약품명 자동완성)
6. 가이드 생성/갱신(비동기 작업) + 일일 일정 조회/이행 상태 기록
7. 챗봇 기능 사용(객관식 프롬프트 + SSE + 세션 삭제)
8. 알림/리마인더/D-day 수신

비동기 공통 원칙:
- 작업 생성 API는 빠르게 `202 Accepted` 반환 (`REQ-114`)
- 상태 전이는 `QUEUED -> PROCESSING -> SUCCEEDED/FAILED`만 허용 (`REQ-118`)
- 실패 원인 표준화(오류 코드/메시지) 및 재시도 정책 운영 (`REQ-012`, `REQ-111`, `REQ-120`)
- 큐 등록 실패 시 `503` 반환 + job `FAILED` 처리, OCR 원본은 즉시 폐기 (`REQ-022`, `REQ-023`, `REQ-126`)

## 5. 기능별 상세 개발 가이드

### 5.1 LLM 기반 안내 가이드 생성

목표:
- 사용자 상황(프로필+처방정보)을 반영한 구조화 가이드를 생성/갱신한다.

요구사항:
- 기능: `REQ-001~010`, `REQ-012~015`, `REQ-045~049`
- 비기능: `REQ-104`, `REQ-112`, `REQ-113`, `REQ-123`

입력 컨텍스트:
- 건강 프로필 객체 (`HealthProfileUpsertRequest`)
- OCR 구조화 결과 (`OcrResult`)
- RAG 지식 컨텍스트

출력 기준:
- 3섹션 구조 유지: `복약안내/생활습관/주의사항` (`REQ-009`)
- JSON 스키마 강제 (`REQ-048`)
- 의료진 상담 고지 문구 필수 (`REQ-006`)

API:
- 명세: `POST /api/v1/guides/jobs`
- 명세: `GET /api/v1/guides/jobs/{job_id}`
- 명세: `GET /api/v1/guides/jobs/{job_id}/result`
- 명세: `POST /api/v1/guides/jobs/{job_id}/refresh`
- 명세: `GET /api/v1/analysis/summary`
- 명세: `GET /api/v1/schedules/daily`
- 명세: `PATCH /api/v1/schedules/items/{item_id}/status`

개발 체크리스트:
- OCR 성공 상태(`SUCCEEDED`)에서만 가이드 작업 생성
- 실패 시 `FAILED` 상태와 failure_code 저장
- 응답 파싱 실패/LLM 타임아웃 처리 경로를 테스트로 고정

DoD:
- 가이드 결과가 요구 스키마를 항상 만족
- 안전 고지가 누락되지 않음
- 가이드 작업 상태/결과 API가 소유권 검증을 통과

### 5.2 실시간 챗봇

목표:
- 의료 질의에 대해 안전하고 근거 기반의 실시간 응답을 제공한다.

요구사항:
- 기능: `REQ-029~044`
- 비기능: `REQ-113`, `REQ-115`, `REQ-117`, `REQ-123`, `REQ-125`

핵심 로직:
1. 객관식 프롬프트 제공 후 대화 시작
2. 의도 분류(잡담/의학/위급)
3. 위급 질의 차단(LLM 호출 금지, 긴급 안내 우선)
4. 하이브리드 검색(Dense + Lexical)
5. 저유사도 시 재질문 유도
6. Query + Context + History 기반 응답 생성
7. 근거 문서가 있으면 출처/제목/링크 표기
8. SSE 스트리밍 전송 + 메시지 상태/토큰 순번 갱신
9. 스트리밍 연결 중단 시 메시지 자동 중단 처리(CANCELLED/FAILED), 복구는 재전송으로 처리
10. 비활성 세션 자동 종료(10~30분)

API:
- 명세: `GET /api/v1/chat/prompt-options`
- 명세: `POST /api/v1/chat/sessions`
- 명세: `GET /api/v1/chat/sessions/{session_id}/messages`
- 명세: `POST /api/v1/chat/sessions/{session_id}/messages`
- 명세: `DELETE /api/v1/chat/sessions/{session_id}`
- 명세: `POST /api/v1/chat/sessions/{session_id}/stream`

개발 체크리스트:
- 위급 키워드 정책 사전/회귀 테스트 마련
- SSE 단절/재접속 시나리오 처리
- 메시지 상태 전이(`PENDING -> STREAMING -> COMPLETED/FAILED/CANCELLED`) 검증
- `last_token_seq`, `updated_at` 갱신 및 최근순 정렬(`updated_at desc`) 검증
- 프롬프트/모델/파라미터 버전 로깅

DoD:
- 위급 질의가 차단되고 정책 메시지가 반환됨
- 저유사도 질문에 대해 과생성 대신 재질문 수행
- 스트리밍 이탈 시 메시지 상태가 `CANCELLED` 또는 `FAILED`로 남고 부분 응답이 조회 가능함
- 근거 추적 로그(문서ID, 프롬프트 버전, 모델 버전) 저장

### 5.3 OCR 기반 의료정보 인식

목표:
- 처방전/약봉투에서 의료정보를 구조화하고 사용자 확인 후 확정 저장한다.

요구사항:
- 기능: `REQ-050~062`
- 비기능: `REQ-104`, `REQ-110`, `REQ-116`, `REQ-120`, `REQ-124`, `REQ-126`

핵심 로직:
1. 파일 업로드(PDF/JPG/PNG)
2. OCR 텍스트/좌표 추출 (좌표는 저신뢰/검수 케이스 선택 저장)
3. 파싱: 약품명/용량/횟수/복용개수/조제일/총처방일
4. ADHD 약물 사전 매핑
5. 필드별 신뢰도 검증
6. 저신뢰 시 사용자 확인/수정/재촬영 유도
7. 사용자 수정 단계에서 약품명 자동완성 제공
8. 확정 데이터 저장 후 원본 이미지 즉시 폐기

API:
- 명세: `POST /api/v1/ocr/documents/upload`
- 명세: `POST /api/v1/ocr/jobs`
- 명세: `GET /api/v1/ocr/jobs/{job_id}`
- 명세: `GET /api/v1/ocr/jobs/{job_id}/result`
- 명세: `PATCH /api/v1/ocr/jobs/{job_id}/confirm`
- 명세: `GET /api/v1/medications/search`

개발 체크리스트:
- 업로드 파일 검증(확장자, 크기, 손상)
- 작업 소유권 및 상태 전이 강제
- OCR 저신뢰 필드의 사용자 수정 루프 구현
- 처리 완료 후 원본 파일 삭제 경로 검증(큐 실패 포함)

DoD:
- OCR 결과가 지정 스키마(`raw_text`, `extracted_medications[]`)를 만족
- 원본 이미지가 DB/클라우드에 남지 않음
- 좌표(raw blocks)는 선택 저장 정책이 적용됨
- 저신뢰 결과가 사용자 확인 플로우로 정상 전환

### 5.4 알림 기능

목표:
- 사용자 작업 완료와 복약 일정 변화에 대해 적시에 안내한다.

요구사항:
- 기능: `REQ-016~021`
- 비기능: `REQ-111`, `REQ-121`

핵심 로직:
1. 가이드 생성 완료 시 자동 알림 발행
2. 알림 목록/미읽음/읽음 처리 제공
3. 리마인더 CRUD 제공(선택 기능)
4. 약 소진일 계산 후 D-day 알림 제공

API:
- 명세: `GET /api/v1/notifications`
- 명세: `GET /api/v1/notifications/unread-count`
- 명세: `PATCH /api/v1/notifications/{notification_id}/read`
- 명세: `PATCH /api/v1/notifications/read-all`
- 명세: `POST/GET/PATCH/DELETE /api/v1/reminders*`
- 명세: `GET /api/v1/reminders/medication-dday`

개발 체크리스트:
- 본인 데이터 접근만 허용(소유권 검사)
- 읽음/미읽음 상태 일관성
- 소진일 계산 정확성 검증(조제일+복용량+주기)

DoD:
- 가이드 완료 알림이 자동 발행됨
- 알림 조회/읽음 API가 권한/경계 테스트를 통과
- D-day 계산 오차 없이 동작

## 6. 공통 비기능 요구사항 운영 기준

성능:
- 핵심 API P95 지연 3초 이내 (`REQ-113`)
- OCR/가이드 작업 생성 1초 이내 `202` 반환 (`REQ-114`)
- 챗봇 SSE는 이벤트 루프 블로킹 최소화 (`REQ-115`)
- OCR 처리 권장 5초 이내 (`REQ-116`)

보안/프라이버시:
- JWT 인증 + 비밀번호 단방향 해시 + 쿠키 보안옵션 (`REQ-107`, `REQ-108`)
- HTTPS/TLS 적용 (`REQ-109`)
- 학습 재사용 금지 및 원본 이미지 즉시 폐기 (`REQ-125`, `REQ-126`)
- 회원 탈퇴는 하드 삭제 대신 소프트 삭제(`is_active=false`)를 적용하고 토큰을 즉시 무효화한다 (`REQ-027`)
- 사용자/챗봇 삭제 API는 본인 소유 데이터 범위에서만 허용한다.
- 보호 API는 `Authorization: Bearer <access_token>`로 사용자 식별(`user_id`는 토큰 payload 기준)
- 외부 API 식별자(`id`, `*_id`, path 파라미터)는 string 계약

품질/운영:
- 프롬프트/모델 버전 관리 (`REQ-123`)
- request_id/job_id/user_id 기반 추적 (`REQ-105`)
- CI에서 테스트/린트/타입체크 통과 (`REQ-122`)
- 장애 감지/알림/롤백 운영 (`REQ-101`, `REQ-119`)
- 외부 API 타임아웃/재시도/오류코드 표준화 (`REQ-120`)

데이터 무결성:
- UTF-8 및 JSON 스키마 일관 사용 (`REQ-102`, `REQ-104`)
- 합성 데이터 우선 정책 (`REQ-103`)
- OCR 필드별 신뢰도 정책 운영값 관리 (`REQ-124`)

## 7. 팀 역할과 책임

Backend:
- API 계약 준수, 권한 검증, 상태 전이 강제, 오류 코드 표준화

AI/Worker:
- OCR/가이드/챗봇 추론 파이프라인, 재시도/모니터링 정책 구현

Frontend:
- 모바일 촬영 UX, OCR 수정 UX, 챗봇 스트리밍 UX, 알림 UX

QA:
- 요구사항 ID 기반 테스트 설계/회귀 자동화, 성능/안전성 검증

## 8. 개발 우선순위 (권장)

1. 인증/접근제어 + OCR 핵심 경로 (`REQ-011`, `REQ-022~028`, `REQ-050~058`, `REQ-061~062`)
2. 가이드/분석/LLM (`REQ-001~010`, `REQ-012~015`, `REQ-045~049`)
3. 챗봇 본 기능 (`REQ-029~044`)
4. 알림/리마인더 확장 (`REQ-016~021`)
5. 운영 품질 보강 (`REQ-101~128`)

## 9. PR/리뷰 운영 규칙

모든 PR 설명에 아래를 명시한다.

1. 관련 REQ ID
2. 변경 API(있으면 Request/Response 요약)
3. 테스트 결과(성공/실패/경계값)
4. 문서 업데이트 여부(`요구사항`, `API 명세`, `팀 가이드`, `원본 산출물`)

## 10. 최종 검수 기준 (Definition of Done)

1. 기능 구현이 REQ ID와 1:1로 추적 가능하다.
2. API 동작이 `docs/API_SPECIFICATION.md`/`docs/API_명세서.xlsx`와 일치한다.
3. 보안/프라이버시 정책이 실제 코드 경로에서 보장된다.
4. `ruff`, `mypy`, `pytest`가 통과한다.
5. 운영 로그로 장애/재현/감사가 가능하다.
6. 문서 3종(`요구사항`, `API`, `팀가이드`)과 원본 산출물 2종(`요구사항_정의서.xlsx`, `API_명세서.xlsx`)이 최신 상태다.
