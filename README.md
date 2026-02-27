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

- 구현됨:
  - 인증/인가 (`/api/v1/auth/*`, `/api/v1/users/me`)
  - OCR 업로드/작업/상태/결과 (`/api/v1/ocr/*`)
  - 가이드 작업/상태/결과 (`/api/v1/guides/*`)
  - 알림 조회/읽음 처리 (`/api/v1/notifications*`)
  - AI Worker 큐 소비, 재시도/실패 처리 기본 구조
- 미구현 또는 고도화 예정:
  - 실시간 챗봇 RAG 파이프라인
  - OCR/가이드 실제 모델 연동 고도화

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
