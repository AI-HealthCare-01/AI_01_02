# AI Health Final

AI Health Final은 ADHD 환자/보호자 지원을 위한 백엔드 프로젝트다.  
`FastAPI + AI Worker + MySQL + Redis + Nginx` 구조로, OCR/가이드/알림 기능을 중심으로 동작하며 챗봇 고도화를 진행 중이다.

## 문서 바로가기

- 요구사항 정의서: `docs/REQUIREMENTS_DEFINITION.md`
- API 명세서: `docs/API_SPECIFICATION.md`
- 팀 개발 가이드라인: `docs/TEAM_DEVELOPMENT_GUIDELINE.md`
- 요구사항 원본 산출물: `docs/요구사항_정의서.xlsx`
- API 명세 원본 산출물: `docs/API_명세서.xlsx`

## 현재 구현 상태 요약

- 구현됨 (87/90건, REQ 기준):
  - 인증/인가 (`/api/v1/auth/*`, `/api/v1/users/me`) — REQ-024~REQ-028
  - 건강 프로필 저장/조회 (`/api/v1/profiles/health`) — REQ-045~REQ-047
  - OCR 업로드/작업/상태/결과/확정 (`/api/v1/ocr/*`) — REQ-050~REQ-058, REQ-061~REQ-062
  - OCR 실패 처리, 가이드 생성 실패 처리 — REQ-022~REQ-023
  - 약물명 자동완성 검색 (`/api/v1/medications/search`) — REQ-062
  - 가이드 작업/상태/결과/갱신 (`/api/v1/guides/*`) — REQ-001~REQ-009
  - 분석 요약 (`/api/v1/analysis/summary`) — REQ-013~REQ-015
  - 일일 일정 조회/상태 업데이트 (`/api/v1/schedules/*`) — REQ-010
  - 챗봇 세션/메시지/스트리밍/삭제 (`/api/v1/chat/*`) — REQ-029~REQ-044
    - RAG 하이브리드 검색 (Dense + BM25), 근거 출처 표기 포함
    - 의도 분류, 안전 가드레일, SSE 스트리밍, 자동 세션 종료
  - 알림 조회/읽음 처리 (`/api/v1/notifications/*`) — REQ-016~REQ-019
  - 복약 리마인더 CRUD/D-day 조회 (`/api/v1/reminders/*`) — REQ-020~REQ-021
  - AI Worker 큐 소비, 재시도/실패 처리, Clova OCR + LLM 파싱 연동
  - LLM 구조화 출력 강제 및 프롬프트 버전 관리 — REQ-048~REQ-049
  - Sentry 연동 (`SENTRY_DSN` 설정 시 자동 활성화) — REQ-119
  - `RequestIDMiddleware` + nginx `X-Request-ID` 헤더 전달 — REQ-105
  - 비활성 세션 자동 종료 백그라운드 루프 — REQ-044
- 대기중 (프론트엔드/배포 후 적용):
  - REQ-059~REQ-060: 촬영 가이드 UX, 복약 시작 요약 출력 (프론트엔드 영역)
  - REQ-109: HTTPS/TLS (EC2 실서버 배포 후 적용)
  - REQ-110~REQ-111: 모바일 최적화, 에러 메시지 매핑 (프론트엔드 영역)
  - REQ-113~REQ-116: 성능 지표 (배포 후 측정)
  - REQ-119: 장애 감지 알림 (SENTRY_DSN 환경변수 입력 후 활성화)

## 프로젝트 구조

```text
.
├── app/                       # FastAPI API 서버
│   ├── apis/                  # v1/v2 API 라우터
│   ├── services/              # 비즈니스 로직
│   ├── repositories/          # DB 접근 계층
│   ├── models/                # Tortoise ORM 모델
│   ├── dtos/                  # Pydantic DTO
│   └── db/                    # DB 초기화/마이그레이션
├── ai_worker/                 # 비동기 작업 워커 (OCR/Guide)
│   ├── tasks/
│   └── main.py
├── docs/                      # 요구사항/API/운영 문서
├── envs/                      # 환경변수 예시
├── scripts/                   # CI/배포 스크립트
├── nginx/                     # 프록시 설정
├── docker-compose.yml
└── pyproject.toml
```

## 로컬 실행

### 사전 준비

- Python 3.13+
- Docker, Docker Compose
- (선택) `uv` 설치

### 1) 환경변수 파일 준비

```bash
cp envs/example.local.env .env
```

### 2) 전체 스택 실행

```bash
docker-compose up -d --build
```

- Swagger: `http://localhost/api/docs`

### 3) 개별 실행 (선택)

```bash
# API
python -m uvicorn app.main:app --reload

# Worker
python -m ai_worker.main
```

## 테스트 및 정적 검증

Windows(.venv 기준):

```powershell
.venv\Scripts\ruff.exe check app ai_worker
.venv\Scripts\ruff.exe format --check app ai_worker
.venv\Scripts\mypy.exe app ai_worker
.venv\Scripts\python.exe -m pytest app/tests -q
```

Linux/macOS(스크립트):

```bash
./scripts/ci/code_fommatting.sh
./scripts/ci/check_mypy.sh
./scripts/ci/run_test.sh
```

## 개발 원칙

- 요구사항 변경 시 `docs/REQUIREMENTS_DEFINITION.md`를 먼저 갱신한다.
- API 계약 영향이 있으면 `docs/API_SPECIFICATION.md`를 함께 갱신한다.
- 구현 PR에는 관련 REQ ID를 명시한다. 예: `REQ-075`, `REQ-083`
