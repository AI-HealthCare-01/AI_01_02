# AI Health Project 팀 개발 가이드라인

문서 버전: v2.1  
작성일: 2026-02-23  
기준 문서:
- `docs/REQUIREMENTS_DEFINITION.md` (v1.7)
- `docs/API_SPECIFICATION.md` (v1.2)
- `docs/PROJECT_MEMORY.md`

문서 변경 이력:
- v2.1 (2026-02-23): API 명세 v1.2 동기화 반영(객체/상태/정책 메모 정합성)
- v2.0 (2026-02-23): 5대 주요 구현 기능 중심으로 전면 개편(요구사항-ID 매핑, API 매핑, 상세 로직, DoD/QA 기준 강화)
- v1.0 (2026-02-23): 초기 팀 가이드 작성

## 1. 문서 목적

이 문서는 팀원이 동일한 기준으로 개발/리뷰/검수하기 위한 실행 기준서다.  
요구사항 정의서의 내용을 실제 개발 단위(기능, API, 데이터, 테스트, 운영)로 정리한다.

## 2. 프로젝트 핵심 구현 기능

본 프로젝트의 주요 구현 기능은 아래 5가지다.

1. LLM 기반 안내 가이드 생성
2. 실시간 챗봇
3. OCR 기반 의료정보 인식
4. 이미지 분류 기반 복약 분석
5. 알림 기능

## 3. 기능별 한눈에 보기

| 기능 | 핵심 목표 | 주요 요구사항 ID | 핵심 API(명세 기준) | 현재 상태 |
|---|---|---|---|---|
| 1. LLM 기반 안내 가이드 생성 | 프로필+처방+지식을 결합한 개인화 복약/생활 가이드 | REQ-010~013, REQ-050~057 | `POST /api/v1/guides/jobs`, `GET /api/v1/guides/jobs/{job_id}`, `GET /api/v1/guides/jobs/{job_id}/result` | 베이스라인 구현, 품질 고도화 필요 |
| 2. 실시간 챗봇 | 안전 가드레일 + 하이브리드 검색 + SSE 스트리밍 | REQ-014~017, REQ-027~032, REQ-058~061 | `POST /api/v1/chat/sessions`, `POST /api/v1/chat/sessions/{session_id}/stream` | 계획 단계 |
| 3. OCR 기반 의료정보 인식 | 처방/약봉투 텍스트 구조화 + 신뢰도 검증 + 사용자 확인 | REQ-005~009, REQ-039~049, REQ-127 | `POST /api/v1/ocr/documents/upload`, `POST /api/v1/ocr/jobs`, `GET /api/v1/ocr/jobs/{job_id}/result`, `PATCH /api/v1/ocr/jobs/{job_id}/confirm` | 업로드/작업/결과 구현, 확인 단계 고도화 필요 |
| 4. 이미지 분류 기반 복약 분석 | 단일 알약 인식 + 판독불가 보호 + 오분류 신고 | REQ-033~038, REQ-062~064 | `POST /api/v1/pill-analysis`, `GET /api/v1/pill-analysis/{analysis_id}`, `POST /api/v1/pill-analysis/{analysis_id}/misclassifications` | 계획 단계 |
| 5. 알림 기능 | 가이드 완료/읽음 처리/리마인더/D-day 안내 | REQ-018~023, REQ-051, REQ-126 | `GET/PATCH /api/v1/notifications*`, `POST/GET/PATCH/DELETE /api/v1/reminders*` | 읽음/목록 구현, 리마인더/D-day 확장 필요 |

## 4. 전체 서비스 흐름 (E2E)

1. 사용자 인증(회원가입/로그인)
2. 건강 프로필 입력
3. 의료문서 업로드
4. OCR -> 파싱/정제 -> 신뢰도 검증
5. 사용자 확인/수정(저신뢰 시)
6. 가이드 생성(비동기 작업)
7. 챗봇/이미지분석 기능 사용
8. 알림/리마인더/D-day 수신

비동기 공통 원칙:
- 작업 생성 API는 빠르게 `202 Accepted` 반환 (`REQ-102`)
- 상태 전이는 `QUEUED -> PROCESSING -> SUCCEEDED/FAILED`만 허용 (`REQ-103`)
- 실패 원인 표준화(오류 코드/메시지) 및 재시도 정책 운영 (`REQ-024`, `REQ-025`, `REQ-124`)

## 5. 기능별 상세 개발 가이드

### 5.1 LLM 기반 안내 가이드 생성

목표:
- 사용자 상황(프로필+처방정보)을 반영한 구조화 가이드를 생성한다.

요구사항:
- 기능: `REQ-010~013`, `REQ-050~057`
- 비기능: `REQ-101`, `REQ-106`, `REQ-123`, `REQ-125`

입력 컨텍스트:
- 건강 프로필 객체 (`HealthProfileUpsertRequest`)
- OCR 구조화 결과 (`OcrResult`)
- RAG 지식 컨텍스트

출력 기준:
- 3섹션 구조 유지: `복약안내/생활습관/주의사항` (`REQ-055`)
- JSON 스키마 강제 (`REQ-056`)
- 의료진 상담 고지 문구 필수 (`REQ-013`)

API:
- 구현: `POST /api/v1/guides/jobs`
- 구현: `GET /api/v1/guides/jobs/{job_id}`
- 구현: `GET /api/v1/guides/jobs/{job_id}/result`
- 계획: `GET /api/v1/analysis/summary`

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
- 기능: `REQ-014~017`, `REQ-027~032`, `REQ-058~061`
- 비기능: `REQ-101`, `REQ-117`, `REQ-118`, `REQ-125`

핵심 로직:
1. 의도 분류(잡담/의학/위급)
2. 위급 질의 차단(LLM 호출 금지, 긴급 안내 우선)
3. 하이브리드 검색(Dense + Lexical)
4. 저유사도 시 재질문 유도
5. Query + Context + History 기반 응답 생성
6. 근거 문서가 있으면 출처/제목/링크 표기
7. SSE 스트리밍 전송
8. 비활성 세션 자동 종료(10~30분)

API:
- 계획: `POST /api/v1/chat/sessions`
- 계획: `GET /api/v1/chat/sessions/{session_id}/messages`
- 계획: `POST /api/v1/chat/sessions/{session_id}/messages`
- 계획: `POST /api/v1/chat/sessions/{session_id}/stream`

개발 체크리스트:
- 위급 키워드 정책 사전/회귀 테스트 마련
- SSE 단절/재접속 시나리오 처리
- 프롬프트/모델/파라미터 버전 로깅

DoD:
- 위급 질의가 100% 차단되고 정책 메시지가 반환됨
- 저유사도 질문에 대해 과생성 대신 재질문 수행
- 근거 추적 로그(문서ID, 프롬프트 버전, 모델 버전) 저장

### 5.3 OCR 기반 의료정보 인식

목표:
- 처방전/약봉투에서 의료정보를 구조화하고 사용자 확인 후 확정 저장한다.

요구사항:
- 기능: `REQ-005~009`, `REQ-039~049`
- 비기능: `REQ-119`, `REQ-120`, `REQ-122`, `REQ-127`

핵심 로직:
1. 파일 업로드(PDF/JPG/PNG)
2. OCR 텍스트/좌표 추출
3. 파싱: 약품명/용량/횟수/복용개수/조제일/총처방일
4. ADHD 약물 사전 매핑
5. 필드별 신뢰도 검증
6. 저신뢰 시 사용자 확인/수정/재촬영 유도
7. 확정 데이터 저장
8. 원본 이미지 즉시 폐기(비영속)

API:
- 구현: `POST /api/v1/ocr/documents/upload`
- 구현: `POST /api/v1/ocr/jobs`
- 구현: `GET /api/v1/ocr/jobs/{job_id}`
- 구현: `GET /api/v1/ocr/jobs/{job_id}/result`
- 계획: `PATCH /api/v1/ocr/jobs/{job_id}/confirm`

개발 체크리스트:
- 업로드 파일 검증(확장자, 크기, 손상)
- 작업 소유권 및 상태 전이 강제
- OCR 저신뢰 필드의 사용자 수정 루프 구현
- 처리 완료 후 원본 파일 삭제 경로 검증

DoD:
- OCR 결과가 지정 스키마(`raw_text`, `extracted_medications[]`)를 만족
- 원본 이미지가 DB/클라우드에 남지 않음
- 저신뢰 결과가 사용자 확인 플로우로 정상 전환

### 5.4 이미지 분류 기반 복약 분석

목표:
- 단일 알약 이미지에서 약물을 식별하고 복약 가이드를 제공한다.

요구사항:
- 기능: `REQ-033~038`, `REQ-062~064`
- 비기능: `REQ-101`, `REQ-116`, `REQ-117`

핵심 로직:
1. 단일 이미지 입력
2. 전처리(리사이즈/정규화 + ROI/중앙크롭 + 배경 노이즈 제거)
3. 다중 객체 감지 시 분석 중단
4. CNN 분류 추론
5. 확률 임계값(`<60%`) 또는 OOD 시 판독불가 반환
6. 성공 시 약물정보 매핑 반환
7. 오분류 신고 접수

API:
- 계획: `POST /api/v1/pill-analysis`
- 계획: `GET /api/v1/pill-analysis/{analysis_id}`
- 계획: `POST /api/v1/pill-analysis/{analysis_id}/misclassifications`

개발 체크리스트:
- 다중 알약 검출 모델/규칙 정의
- 판독불가 기준(품질/OOD/확률) 통일
- 오분류 신고 데이터의 재학습 파이프라인 연계 설계

DoD:
- 단일 객체 원칙 위반 시 안내 메시지 반환
- 오진 방지 정책(판독불가 처리)이 경계값 테스트를 통과
- 오분류 신고 API 계약이 저장/추적까지 연결

### 5.5 알림 기능

목표:
- 사용자 작업 완료와 복약 일정 변화에 대해 적시에 안내한다.

요구사항:
- 기능: `REQ-018~023`, `REQ-051`
- 비기능: `REQ-126`

핵심 로직:
1. 가이드 생성 완료 시 자동 알림 발행
2. 알림 목록/미읽음/읽음 처리 제공
3. 리마인더 CRUD 제공(선택 기능)
4. 약 소진일 계산 후 D-day 알림 제공

API:
- 구현: `GET /api/v1/notifications`
- 구현: `GET /api/v1/notifications/unread-count`
- 구현: `PATCH /api/v1/notifications/{notification_id}/read`
- 구현: `PATCH /api/v1/notifications/read-all`
- 계획: `POST/GET/PATCH/DELETE /api/v1/reminders*`
- 계획: `GET /api/v1/reminders/medication-dday`

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
- 챗봇 TTFT/이미지분석 응답 P95 3초 목표 (`REQ-101`)
- OCR 처리 권장 5초 이내 (`REQ-120`)

보안/프라이버시:
- JWT 인증, 비밀번호 해시, HTTPS/TLS (`REQ-104`, `REQ-114`)
- 학습 재사용 금지 및 원본 이미지 즉시 폐기 (`REQ-113`, `REQ-127`)

품질/운영:
- 프롬프트/모델/전처리 버전 관리 (`REQ-106`, `REQ-116`)
- request_id/job_id/user_id 기반 추적 (`REQ-107`)
- 외부 API 타임아웃/재시도/오류코드 표준화 (`REQ-124`)

데이터 무결성:
- UTF-8, JSON 스키마 강제 (`REQ-111`, `REQ-123`)
- OCR 필드별 신뢰도 정책 운영값 관리 (`REQ-122`)

## 7. 팀 역할과 책임

Backend:
- API 계약 준수, 권한 검증, 상태 전이 강제, 오류 코드 표준화

AI/Worker:
- OCR/가이드/챗봇/이미지분석 추론 파이프라인, 재시도/모니터링 정책 구현

Frontend:
- 모바일 촬영 UX, OCR 수정 UX, 챗봇 스트리밍 UX, 판독불가 안내 UX

QA:
- 요구사항 ID 기반 테스트 설계/회귀 자동화, 성능/안전성 검증

## 8. 개발 우선순위 (권장)

1. 챗봇 본 기능 (`REQ-014~017`, `REQ-027~032`, `REQ-056~061`)
2. 이미지분석 파이프라인 (`REQ-033~038`, `REQ-062~064`)
3. OCR 고도화 (`REQ-039~045`, `REQ-048~049`, `REQ-127`)
4. 프로필/개인화 분석 (`REQ-046~047`, `REQ-050~055`)
5. 알림 확장 (`REQ-023`, `REQ-051`, `REQ-126`)
6. 운영 품질 보강 (`REQ-101`, `REQ-106`, `REQ-113~125`)

## 9. PR/리뷰 운영 규칙

모든 PR 설명에 아래를 명시한다.

1. 관련 REQ ID
2. 변경 API(있으면 Request/Response 요약)
3. 테스트 결과(성공/실패/경계값)
4. 문서 업데이트 여부(`요구사항`, `API 명세`, `팀 가이드`, `프로젝트 메모`)

## 10. 최종 검수 기준 (Definition of Done)

1. 기능 구현이 REQ ID와 1:1로 추적 가능하다.
2. API 동작이 `docs/API_SPECIFICATION.md`와 일치한다.
3. 보안/프라이버시 정책이 실제 코드 경로에서 보장된다.
4. `ruff`, `mypy`, `pytest`가 통과한다.
5. 운영 로그로 장애/재현/감사가 가능하다.
6. 문서 4종(`요구사항`, `API`, `팀가이드`, `메모`)이 최신 상태다.
