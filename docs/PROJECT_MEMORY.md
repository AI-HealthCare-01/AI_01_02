# Project Memory (Living Baseline)

Last updated: 2026-02-20
Scope: Full repository scan excluding generated/vendor directories (`.venv`, `.mypy_cache`, IDE cache).

## 1) Current Product State

- Runtime shape is a two-service backend:
- `app/`: FastAPI API server with auth, user profile, notification APIs, OCR upload/job/status/result APIs, guide job/status/result APIs.
- `ai_worker/`: Redis queue consumer + OCR/Guide placeholder processors + heartbeat + retry/state-transition guard.
- Infra includes MySQL, Redis, Nginx, Docker Compose, CI workflow, and deployment scripts.
- Notification feature appears recently added and partially versioned (`v1` real API, `v2` capability placeholder).

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
- Job status endpoint returns job state and timestamps for requesting owner only.
- Job result endpoint returns OCR result when status is `SUCCEEDED`.
- Guide flow:
- Job create endpoint validates OCR ownership and `SUCCEEDED` status, creates `QUEUED` guide job, and publishes `job_id` to Redis list queue.
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
- Guide failure path: `QUEUED -> PROCESSING -> FAILED` and stores standardized `failure_code` + error message.

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
- `.venv\Scripts\python.exe -m pytest app/tests -q`
- Result at analysis time:
- `39 passed in 16.78s`
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
- Guide job-create/status/result APIs + safety notice + worker placeholder generation (REQ-010~013 basic).
- Guide failure status baseline implemented (REQ-025 partial).
- Not implemented yet (major):
- Production-grade OCR model inference pipeline (currently placeholder processor).
- Production-grade guide LLM inference pipeline (currently placeholder processor).
- DB-level transition constraints and operational retry tuning (jitter/backoff strategy, dead-letter consumer).
- Chat session/message/context/history (REQ-014~017).
- Reminder CRUD (REQ-023).
- Failure handling states for OCR/guide pipelines as full production workflow (REQ-024/025).
- Many non-functional requirements exist only as target, not enforced instrumentation.

## 11) Known Working Tree Situation (at scan time)

- Repository is dirty with multiple modified and untracked files.
- Notably includes new notification-related files under:
- `app/apis/v1/dev_routers.py`
- `app/apis/v1/notification_routers.py`
- `app/apis/v2/notification_routers.py`
- `app/models/notifications.py`
- `app/repositories/notification_repository.py`
- `app/services/notifications.py`
- `app/tests/notification_apis/*`
- `app/tests/dev_apis/*`
- `app/templates/notification_playground.html`
- plus migration and docs additions.

## 12) Memory Update Protocol

- Keep this file as the first read on each new work session.
- Then read `docs/PROJECT_FILE_INDEX.md` to detect file additions/removals quickly.
- On every feature change, update:
- API Surface section
- Data Model snapshot
- Requirement gap mapping
- Test baseline section (include command + result)
- If behavior changes, add date-stamped note under this section:
- Format: `YYYY-MM-DD: <what changed + affected files>`
- 2026-02-20: full-scan baseline revalidated, tests re-run (`16 passed`).
- 2026-02-20: OCR domain models/migration/tests added (`18 passed`).
- 2026-02-20: OCR upload/job/status APIs + API tests added (`25 passed`).
- 2026-02-20: OCR Redis queue publish + worker consume + result API + worker tests (`29 passed`).
- 2026-02-20: OCR retry_count/max_retries/failure_code + strict transition guard + retry loop (`30 passed`).
- 2026-02-20: OCR exponential backoff retry queue + dead-letter queue introduced (`31 passed`).
- 2026-02-20: Guide domain/migration + guide API + guide worker placeholder pipeline added (`39 passed`).
