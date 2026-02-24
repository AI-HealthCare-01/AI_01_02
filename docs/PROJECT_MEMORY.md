# Project Memory (Living Baseline)

Last updated: 2026-02-24
Scope: Full repository scan excluding generated/vendor directories (`.venv`, `.mypy_cache`, IDE cache).

## 1) Current Product State

- Runtime shape is a two-service backend:
- `app/`: FastAPI API server with auth, user profile, notification APIs, OCR upload/job/status/result APIs, guide job/status/result APIs.
- `ai_worker/`: Redis queue consumer + OCR/Guide placeholder processors + heartbeat + retry/state-transition guard.
- `ADHD Care Web App Design/`: Figma wireframe React app for UX prototyping (not production API runtime).
- Infra includes MySQL, Redis, Nginx, Docker Compose, CI workflow, and deployment scripts.
- Notification feature appears recently added and partially versioned (`v1` real API, `v2` capability placeholder).
- Canonical planning docs are split and versioned:
- `docs/REQUIREMENTS_DEFINITION.md` (v1.10)
- `docs/API_SPECIFICATION.md` (v1.7)
- `docs/TEAM_DEVELOPMENT_GUIDELINE.md` (v2.6)

## 2) Repository Map (Meaningful Files)

- API entrypoint: `app/main.py`
- API router composition:
- `app/apis/v1/__init__.py`
- `app/apis/v2/__init__.py`
- Auth routes: `app/apis/v1/auth_routers.py`
- User routes: `app/apis/v1/user_routers.py`
- OCR routes: `app/apis/v1/ocr_routers.py`
- Guide routes: `app/apis/v1/guide_routers.py`
- Notification routes:
- `app/apis/v1/notification_routers.py`
- `app/apis/v2/notification_routers.py`
- Dev playground route: `app/apis/v1/dev_routers.py`
- Services:
- `app/services/auth.py`
- `app/services/users.py`
- `app/services/jwt.py`
- `app/services/notifications.py`
- `app/services/ocr.py`
- `app/services/ocr_queue.py`
- `app/services/guides.py`
- `app/services/guide_queue.py`
- Repositories:
- `app/repositories/user_repository.py`
- `app/repositories/notification_repository.py`
- `app/repositories/ocr_repository.py`
- `app/repositories/guide_repository.py`
- Models:
- `app/models/users.py`
- `app/models/notifications.py`
- `app/models/ocr.py`
- `app/models/guides.py`
- Worker internals:
- `ai_worker/db.py`
- `ai_worker/tasks/ocr.py`
- `ai_worker/tasks/guide.py`
- `ai_worker/main.py`
- Migrations:
- `app/db/migrations/models/0_20260204142014_init.py`
- `app/db/migrations/models/1_20260220153000_add_notifications.py`
- `app/db/migrations/models/2_20260220191500_add_ocr_domain.py`
- `app/db/migrations/models/3_20260220204500_add_ocr_retry_policy.py`
- `app/db/migrations/models/4_20260220213000_add_guide_domain.py`
- JWT internals:
- `app/utils/jwt/backends.py`
- `app/utils/jwt/tokens.py`
- `app/utils/jwt/state.py`
- Tests:
- `app/tests/auth_apis/*`
- `app/tests/user_apis/*`
- `app/tests/notification_apis/*`
- `app/tests/dev_apis/*`
- `app/tests/ocr_apis/*`
- `app/tests/ocr_models/*`
- `app/tests/ocr_worker/*`
- `app/tests/guide_apis/*`
- `app/tests/guide_worker/*`
- Project docs:
- `docs/REQUIREMENTS_DEFINITION.md`
- `docs/API_SPECIFICATION.md`
- `docs/TEAM_DEVELOPMENT_GUIDELINE.md`
- `docs/ADHD_CARE_SERVICE_BLUEPRINT.md`
- `docs/PROJECT_MEMORY.md`
- `docs/PROJECT_FILE_INDEX.md`
- Wireframe frontend:
- `ADHD Care Web App Design/src/app/routes.ts`
- `ADHD Care Web App Design/src/app/components/Layout.tsx`
- `ADHD Care Web App Design/src/app/pages/OcrScan.tsx`
- `ADHD Care Web App Design/src/app/pages/AiCoach.tsx`
- `ADHD Care Web App Design/src/app/pages/Chatbot.tsx`
- `ADHD Care Web App Design/src/app/pages/Notifications.tsx`
- `ADHD Care Web App Design/src/app/pages/Signup.tsx`
- `ADHD Care Web App Design/src/app/pages/Onboarding.tsx`

## 3) Core Architecture and Flow

- FastAPI app uses ORJSON response class and mounts:
- `v1` under `/api/v1`
- `v2` under `/api/v2`
- Tortoise ORM is initialized via `register_tortoise`.
- Dependency chain for protected APIs:
- `Authorization: Bearer <access_token>`
- `get_request_user` -> `JwtService.verify_jwt(access)` -> user lookup.
- Auth flow:
- Signup validates input, checks uniqueness, hashes password, inserts user.
- Login verifies password and active status, updates `last_login`, returns access token.
- Refresh token is set as cookie at login and used by `/auth/token/refresh`.
- User update flow:
- PATCH `/users/me` updates fields, normalizes phone, checks uniqueness.
- On successful update, creates system notification (`profile_updated` event payload).
- Notification flow:
- List supports `limit`, `offset`, `is_read` filter, returns `items + unread_count`.
- Single read marks one notification read.
- Read-all marks unread notifications read in bulk.
- OCR flow:
- Upload endpoint validates extension/size and stores file metadata in `documents`.
- Job create endpoint validates document ownership, creates `QUEUED` job, then publishes `job_id` to Redis list queue.
- Queue publish failure sets job `FAILED` with standardized failure info, returns `503`, and disposes raw upload file immediately.
- Job status endpoint returns job state and timestamps for requesting owner only.
- Job result endpoint returns OCR result when status is `SUCCEEDED`.
- Worker success/terminal-failure 처리 후 원본 업로드 파일을 즉시 폐기한다.
- Guide flow:
- Job create endpoint validates OCR ownership and `SUCCEEDED` status, creates `QUEUED` guide job, and publishes `job_id` to Redis list queue.
- Queue publish failure sets job `FAILED` with standardized failure info and returns `503`.
- Job status endpoint returns guide state and timestamps for requesting owner only.
- Job result endpoint returns generated guide payload when status is `SUCCEEDED`.
- Worker flow:
- Worker blocks on Redis queues (`BLPOP`) and consumes `ocr_job_id` / `guide_job_id`.
- Worker periodically flushes delayed retry jobs from retry zset back to main queue.
- On consume, OCR/Guide job status transitions are guarded by allowed-transition checks.
- OCR success path: `QUEUED -> PROCESSING -> SUCCEEDED`.
- Failure path with retries: `QUEUED -> PROCESSING -> QUEUED` with exponential backoff.
- Retry exhausted jobs move to dead-letter queue and are marked `FAILED`.
- Success creates/updates `ocr_results`; failure stores standardized `failure_code` + error message.
- Guide success path: `QUEUED -> PROCESSING -> SUCCEEDED` and creates/updates `guide_results` with fixed safety notice.
- Guide failure path with retries: `QUEUED -> PROCESSING -> QUEUED` with exponential backoff.
- Guide retry exhausted jobs move to dead-letter queue and are marked `FAILED`.

## 4) API Surface (Current)

- `POST /api/v1/auth/signup`
- `POST /api/v1/auth/login`
- `GET /api/v1/auth/token/refresh`
- `GET /api/v1/users/me`
- `PATCH /api/v1/users/me`
- `GET /api/v1/notifications`
- `GET /api/v1/notifications/unread-count`
- `PATCH /api/v1/notifications/{notification_id}/read`
- `PATCH /api/v1/notifications/read-all`
- `POST /api/v1/ocr/documents/upload`
- `POST /api/v1/ocr/jobs`
- `GET /api/v1/ocr/jobs/{job_id}`
- `GET /api/v1/ocr/jobs/{job_id}/result`
- `POST /api/v1/guides/jobs`
- `GET /api/v1/guides/jobs/{job_id}`
- `GET /api/v1/guides/jobs/{job_id}/result`
- `GET /api/v1/dev/notifications-playground`
- `GET /api/v2/notifications/capabilities`

## 5) Data Model Snapshot

- `users` table (`app/models/users.py`):
- id, email, hashed_password, name, gender, birthday, phone_number,
- is_active, is_admin, last_login, created_at, updated_at.
- `notifications` table (`app/models/notifications.py`):
- id, user_id(FK users, cascade), type, title, message, is_read, read_at, payload(JSON), created_at.
- Notification indexes:
- `(user_id, is_read)`
- `(user_id, created_at)`
- `documents` table (`app/models/ocr.py`):
- id, user_id(FK users, cascade), document_type, file_name, file_path, file_size, mime_type, uploaded_at.
- Document indexes:
- `(user_id, uploaded_at)`, `(document_type)`
- `ocr_jobs` table (`app/models/ocr.py`):
- id, user_id(FK users), document_id(FK documents), status(QUEUED/PROCESSING/SUCCEEDED/FAILED),
- retry_count, max_retries, failure_code, error_message, queued_at, started_at, completed_at, created_at, updated_at.
- OCR job indexes:
- `(user_id, status)`, `(document_id, created_at)`, `(status, retry_count)`
- `ocr_results` table (`app/models/ocr.py`):
- id, job_id(1:1, unique FK ocr_jobs), extracted_text, structured_data(JSON), created_at, updated_at.
- `guide_jobs` table (`app/models/guides.py`):
- id, user_id(FK users), ocr_job_id(FK ocr_jobs), status(QUEUED/PROCESSING/SUCCEEDED/FAILED),
- retry_count, max_retries, failure_code, error_message, queued_at, started_at, completed_at, created_at, updated_at.
- Guide job indexes:
- `(user_id, status)`, `(ocr_job_id, created_at)`, `(status, retry_count)`
- `guide_results` table (`app/models/guides.py`):
- id, job_id(1:1, unique FK guide_jobs), medication_guidance, lifestyle_guidance,
- risk_level(LOW/MEDIUM/HIGH), safety_notice, structured_data(JSON), created_at, updated_at.

## 6) Config and Security Notes

- Settings source: `.env` (`pydantic-settings`, `extra="allow"`).
- Environment keys currently expected (keys only):
- `DOCKER_USER`, `DOCKER_REPOSITORY`, `APP_VERSION`, `SECRET_KEY`, `COOKIE_DOMAIN`
- `AI_WORKER_VERSION`
- `DB_HOST`, `DB_PORT`, `DB_EXPOSE_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_ROOT_PASSWORD`, `DB_NAME`
- `REDIS_HOST`, `REDIS_PORT`, `REDIS_DB`, `REDIS_PASSWORD`
- Runtime upload settings:
- `MEDIA_DIR` (default: `app/media`)
- `OCR_MAX_FILE_SIZE_BYTES` (default: `10MB`)
- `OCR_ALLOWED_EXTENSIONS` (default: `pdf,jpg,jpeg,png`)
- OCR queue settings:
- `OCR_QUEUE_KEY` (default: `ocr:jobs`)
- `OCR_RETRY_QUEUE_KEY` (default: `ocr:jobs:retry`)
- `OCR_DEAD_LETTER_QUEUE_KEY` (default: `ocr:jobs:dead-letter`)
- `OCR_RETRY_BACKOFF_BASE_SECONDS` (default: `5`)
- `OCR_RETRY_BACKOFF_MAX_SECONDS` (default: `60`)
- `OCR_RETRY_RELEASE_BATCH_SIZE` (default: `100`)
- `OCR_JOB_MAX_RETRIES` (default: `3`)
- Guide queue settings:
- `GUIDE_QUEUE_KEY` (default: `guide:jobs`)
- `GUIDE_RETRY_QUEUE_KEY` (default: `guide:jobs:retry`)
- `GUIDE_DEAD_LETTER_QUEUE_KEY` (default: `guide:jobs:dead-letter`)
- `GUIDE_RETRY_BACKOFF_BASE_SECONDS` (default: `5`)
- `GUIDE_RETRY_BACKOFF_MAX_SECONDS` (default: `60`)
- `GUIDE_RETRY_RELEASE_BATCH_SIZE` (default: `100`)
- `GUIDE_JOB_MAX_RETRIES` (default: `3`)
- Timezone default fallback handles missing `zoneinfo`.
- JWT:
- Algorithm default `HS256`.
- Access expiration default 60m.
- Refresh expiration default 14d.
- Leeway default 5s.
- Refresh cookie:
- HttpOnly always.
- `Secure=True` only when `ENV == PROD`.
- Password hashing: Passlib bcrypt context (`app/utils/security.py`).

## 7) Test Baseline

- Local execution command used:
- `.venv\Scripts\ruff.exe check app ai_worker`
- `.venv\Scripts\ruff.exe format --check app ai_worker`
- `.venv\Scripts\mypy.exe app ai_worker`
- `.venv\Scripts\python.exe -m pytest app/tests -q`
- `npm run build` (workdir: `ADHD Care Web App Design`)
- Result at analysis time:
- `ruff check`: passed
- `ruff format --check`: passed
- `mypy`: passed
- `46 passed in 15.95s`
- `vite build` 성공 (`1619 modules transformed`, output: `dist/assets/index-BGiojbbD.js`)
- Covered suites:
- auth signup/login/refresh
- user me read/update
- notification list/read/read-all/unread-count and ownership guard
- dev playground HTML endpoint
- OCR upload/create-job/status/result API and ownership checks
- OCR model create/relationship baseline
- OCR worker processing success/failure status transition
- OCR retry backoff and dead-letter routing
- Guide create/status/result API and ownership/ready-state checks
- Guide worker processing success/failure status transition

## 8) Worker Snapshot

- `ai_worker/main.py` initializes Tortoise DB, consumes Redis queue, and runs heartbeat loop.
- Queue consumer: `ai_worker/tasks/ocr.py::OcrQueueConsumer` (`BLPOP` by `OCR_QUEUE_KEY`).
- Retry scheduler: `ai_worker/tasks/ocr.py::flush_due_retries` and `schedule_retry` (`OCR_RETRY_QUEUE_KEY`).
- Dead-letter writer: `ai_worker/tasks/ocr.py::send_to_dead_letter` (`OCR_DEAD_LETTER_QUEUE_KEY`).
- Job processor: `ai_worker/tasks/ocr.py::process_ocr_job`.
- Queue consumer: `ai_worker/tasks/guide.py::GuideQueueConsumer` (`GUIDE_QUEUE_KEY`).
- Retry scheduler: `ai_worker/tasks/guide.py::flush_due_retries` and `schedule_retry` (`GUIDE_RETRY_QUEUE_KEY`).
- Dead-letter writer: `ai_worker/tasks/guide.py::send_to_dead_letter` (`GUIDE_DEAD_LETTER_QUEUE_KEY`).
- Job processor: `ai_worker/tasks/guide.py::process_guide_job`.
- Placeholder OCR output currently uses file metadata/size, not real OCR engine yet.
- Placeholder guide output currently uses OCR text + fixed template/safety notice, not real LLM yet.
- Graceful shutdown via SIGINT/SIGTERM with DB/Redis close.

## 9) Infra and Delivery Snapshot

- Compose files:
- `docker-compose.yml` for local/dev.
- `docker-compose.prod.yml` for production with certbot container.
- Nginx reverse proxy config files:
- `nginx/default.conf`
- `nginx/prod_http.conf`
- `nginx/prod_https.conf`
- CI workflow:
- `ruff check`, `ruff format --check`, `pytest + coverage`.
- Deployment scripts:
- `scripts/deployment.sh` (build/push/deploy via ssh + docker compose).
- `scripts/certbot.sh` (cert issuance and https config application).

## 10) Requirement Gap vs docs/REQUIREMENTS_DEFINITION.md

- Implemented in code now:
- Auth basic flow (REQ-001~004, partial).
- User self profile read/update.
- Notification APIs (subset of REQ-018~022).
- OCR upload/job-create/status/result APIs + schema (REQ-005~009 basic).
- OCR status-transition/retry guard rails in worker logic (REQ-103 partial).
- OCR retry backoff + dead-letter queue baseline implemented.
- OCR worker raw image disposal after processing completion/final failure (REQ-127 baseline).
- Guide job-create/status/result APIs + safety notice + worker placeholder generation (REQ-010~013 basic).
- Guide retry backoff + dead-letter queue baseline implemented.
- Queue publish failure on OCR/Guide create path is fail-fast (`503`) and job is marked `FAILED`.
- Not implemented yet (major):
- Production-grade OCR model inference pipeline (currently placeholder processor).
- Production-grade guide LLM inference pipeline (currently placeholder processor).
- DB-level transition constraints and operational retry tuning (jitter/backoff strategy, dead-letter consumer).
- Chat session/message/context/history (REQ-014~017).
- Reminder CRUD (REQ-023).
- Failure handling states for OCR/guide pipelines as full production workflow (REQ-024/025, partial baseline done).
- Many non-functional requirements exist only as target, not enforced instrumentation.

## 11) Known Working Tree Situation (at scan time)

- Repository has local working-tree changes (document updates/renames in progress on `main`).
- Always re-check exact pending files via `git status --short --branch` before commit/push.
- HEAD commit is `0b93db3` on branch `main` (dated 2026-02-22).

## 12) Memory Update Protocol

- Keep this file as the first read on each new work session.
- Then read `docs/PROJECT_FILE_INDEX.md` to detect file additions/removals quickly.
- On every feature change, update:
- API Surface section
- Data Model snapshot
- Requirement gap mapping
- Test baseline section (include command + result)
- Keep requirements/API/team guideline documents synchronized when contracts change:
- `docs/REQUIREMENTS_DEFINITION.md`
- `docs/API_SPECIFICATION.md`
- `docs/TEAM_DEVELOPMENT_GUIDELINE.md`
- If behavior changes, add date-stamped note under this section:
- Format: `YYYY-MM-DD: <what changed + affected files>`
- 2026-02-20: full-scan baseline revalidated, tests re-run (`16 passed`).
- 2026-02-20: OCR domain models/migration/tests added (`18 passed`).
- 2026-02-20: OCR upload/job/status APIs + API tests added (`25 passed`).
- 2026-02-20: OCR Redis queue publish + worker consume + result API + worker tests (`29 passed`).
- 2026-02-20: OCR retry_count/max_retries/failure_code + strict transition guard + retry loop (`30 passed`).
- 2026-02-20: OCR exponential backoff retry queue + dead-letter queue introduced (`31 passed`).
- 2026-02-20: Guide domain/migration + guide API + guide worker placeholder pipeline added (`39 passed`).
- 2026-02-23: full project rescan revalidated; test baseline re-run (`39 passed in 16.79s`).
- 2026-02-23: planning doc renamed from `docs/READ.md` to `docs/ADHD_CARE_SERVICE_BLUEPRINT.md`.
- 2026-02-23: file index/memory docs re-synced to current repository layout.
- 2026-02-23: `ruff format` 적용 및 Redis/Tortoise 관련 `mypy` 타입 오류 20건 정리.
- 2026-02-23: 검증 재실행 완료 (`ruff check`, `ruff format --check`, `mypy`, `pytest 39 passed in 17.08s`).
- 2026-02-23: 요구사항/계약 문서 분리본 최신화(`REQUIREMENTS v1.7`, `API SPEC v1.1`) 및 팀 가이드(`docs/TEAM_DEVELOPMENT_GUIDELINE.md`) 추가.
- 2026-02-23: `README.md`를 템플릿 설명에서 프로젝트 실사용 가이드 중심으로 개편.
- 2026-02-23: `docs/PROJECT_FILE_INDEX.md` 재생성(신규 문서 포함) 및 검증 재실행 완료 (`ruff`, `mypy`, `pytest 39 passed in 17.03s`).
- 2026-02-23: 팀 가이드 v2.0으로 전면 개편(5대 주요 구현 기능 기준 재작성).
- 2026-02-23: API 명세 v1.2로 동기화(챗봇 출처/재질문/자동세션 종료 메타, OCR 원본 폐기 정책, 누락 객체 정의 보강).
- 2026-02-23: 팀 가이드 v2.1로 버전 동기화(API 명세 v1.2 기준 참조 버전/이력 정합화).
- 2026-02-23: PDF 원문 보존용 RAW 문서 재생성(`docs/PROJECT_TOPIC_AND_EVALUATION_CRITERIA_RAW.json`, `docs/PROJECT_TOPIC_AND_EVALUATION_CRITERIA_RAW.md`) 및 무결성 검증 완료.
- 2026-02-23: OCR 워커에 원본 파일 즉시 폐기 로직 반영(성공/최종실패), 사용자 본인 이메일/전화번호 재저장 시 중복 충돌 오탐 수정, 검증 재실행(`40 passed`).
- 2026-02-23: RAW 원문 보존 파일(`docs/PROJECT_TOPIC_AND_EVALUATION_CRITERIA_RAW.json`, `docs/PROJECT_TOPIC_AND_EVALUATION_CRITERIA_RAW.md`) 삭제 및 문서 참조 정리.
- 2026-02-24: 기획 범위 변경 반영으로 이미지 분류 기반 복약 분석 관련 문서 요구사항/API/팀가이드/ERD 전면 정리(`docs/REQUIREMENTS_DEFINITION.md`, `docs/API_SPECIFICATION.md`, `docs/TEAM_DEVELOPMENT_GUIDELINE.md`, `docs/ERD_DBDIAGRAM_TOBE.dbml`, `README.md`).
- 2026-02-24: `ADHD Care Web App Design` 와이어프레임을 4대 기능 기준으로 정합화(이미지 분류 화면 제거, OCR 확인/수정 플로우 보강, 챗봇/알림 화면 신규 추가, 회원가입/온보딩 스키마 보강) 및 프런트 빌드 검증 완료(`npm install`, `npm run build`).
- 2026-02-24: 전체 정합성 검수 반영으로 JWT 무효 토큰 응답 코드를 401로 통일하고 회귀 테스트 2건을 추가했으며(`app/services/jwt.py`, `app/tests/auth_apis/test_token_api.py`, `app/tests/user_apis/test_user_me_apis.py`), API/팀가이드 문서를 구현 응답 스키마 기준으로 동기화했다(`docs/API_SPECIFICATION.md`, `docs/TEAM_DEVELOPMENT_GUIDELINE.md`), 검증 재실행 완료(`ruff`, `mypy`, `pytest 42 passed`, `npm run build`).
- 2026-02-24: OCR/Guide 작업 생성 시 큐 publish 실패 고착을 방지하도록 `503 + FAILED` 처리로 보강하고(`app/services/ocr.py`, `app/services/guides.py`), 가이드 워커에 재시도/지연큐/데드레터를 추가했다(`ai_worker/tasks/guide.py`, `ai_worker/main.py`, `ai_worker/core/config.py`), API/워커 회귀 테스트 4건을 확장했다(`app/tests/ocr_apis/test_ocr_apis.py`, `app/tests/guide_apis/test_guide_apis.py`, `app/tests/guide_worker/test_guide_worker_tasks.py`), 문서 동기화 및 검증 재실행 완료(`ruff`, `mypy`, `pytest 46 passed`, `npm run build`).
- 2026-02-24: OCR 큐 등록 실패 시 원본 파일까지 즉시 폐기하도록 보강하고(`app/services/ocr.py`), API 회귀 테스트에 파일 폐기 검증을 추가했으며(`app/tests/ocr_apis/test_ocr_apis.py`), 요구사항/API/팀가이드에 raw blocks 선택 저장 정책을 명시했다(`docs/REQUIREMENTS_DEFINITION.md`, `docs/API_SPECIFICATION.md`, `docs/TEAM_DEVELOPMENT_GUIDELINE.md`).
- 2026-02-24: 삭제된 `docs/ERD_DBDIAGRAM.dbml` 반영 후 문서-코드 정합성 재검수로 API 명세(v1.7)에 구현 보조 엔드포인트(`/api/v2/notifications/capabilities`, `/api/v1/dev/notifications-playground`)를 명시하고 팀 가이드(v2.6)와 파일 인덱스를 동기화했으며, 검증 재실행(`ruff check`, `ruff format --check`, `mypy`, `pytest 46 passed`, `npm run build`)을 완료했다.
