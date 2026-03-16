import asyncio
import re
import time
import uuid
from contextlib import asynccontextmanager
from datetime import UTC, datetime
from pathlib import Path

import sentry_sdk
from fastapi import FastAPI, HTTPException, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import ORJSONResponse
from sentry_sdk.integrations.fastapi import FastApiIntegration
from sentry_sdk.integrations.starlette import StarletteIntegration
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response
from tortoise import Tortoise

from app.apis.v1 import v1_routers
from app.apis.v2 import v2_routers
from app.core import config
from app.core.config import Env
from app.core.exceptions import AppException, ErrorCode
from app.core.logger import default_logger as logger
from app.db.databases import initialize_tortoise
from app.dtos.errors import ApiError
from app.services.chat import close_inactive_sessions
from app.services.guide_automation import GuideAutomationService
from app.services.reminders import ReminderService

_SESSION_CLOSE_INTERVAL_SECONDS = 60
_DEPLETION_CHECK_INTERVAL_SECONDS = 3600  # 1시간마다 소진 체크


async def _session_auto_close_loop() -> None:
    """REQ-044: 주기적으로 비활성 세션을 CLOSED 처리."""
    while True:
        await asyncio.sleep(_SESSION_CLOSE_INTERVAL_SECONDS)
        try:
            closed = await close_inactive_sessions()
            if closed:
                logger.info("auto_close_sessions", extra={"closed_count": closed})
        except Exception as exc:  # noqa: BLE001
            logger.warning("auto_close_sessions_error", extra={"error": str(exc)})


async def _run_migrations() -> None:
    """누락된 마이그레이션 SQL을 직접 실행 (aerich 포맷 호환 문제 우회)."""
    migration_dir = Path(__file__).parent / "db" / "migrations" / "models"
    conn = Tortoise.get_connection("default")

    try:
        result = await conn.execute_query("SELECT version FROM aerich ORDER BY id")
        applied = {row["version"] for row in result[1]}
    except Exception:  # noqa: BLE001
        applied = set()

    for migration_file in sorted(migration_dir.glob("[0-9]*.py")):
        name = migration_file.name
        if name in applied:
            continue
        try:
            source = migration_file.read_text(encoding="utf-8")
            match = re.search(r'async def upgrade.*?return\s+"""(.*?)"""', source, re.DOTALL)
            if not match:
                logger.warning("migration SQL not found: %s", name)
                continue
            sql = match.group(1).strip()
            for stmt in sql.split(";"):
                stmt = stmt.strip()
                if stmt:
                    try:
                        await conn.execute_query(stmt)
                    except Exception as e:  # noqa: BLE001
                        logger.warning("migration stmt warning (ignored): %s | %s", name, e)
            await conn.execute_query(
                "INSERT IGNORE INTO aerich (version, app, content) VALUES (%s, %s, %s)", [name, "models", "{}"]
            )
            logger.info("migration applied: %s", name)
        except Exception as e:  # noqa: BLE001
            logger.error("migration failed: %s | %s", name, e)


async def _depletion_auto_disable_loop() -> None:
    """소진된 리마인더를 주기적으로 자동 비활성화."""
    while True:
        await asyncio.sleep(_DEPLETION_CHECK_INTERVAL_SECONDS)
        try:
            count = await ReminderService.disable_depleted_reminders()
            if count:
                logger.info("depletion_auto_disable", extra={"disabled_count": count})
        except Exception as exc:  # noqa: BLE001
            logger.warning("depletion_auto_disable_error", extra={"error": str(exc)})


async def _guide_weekly_refresh_loop() -> None:
    service = GuideAutomationService()
    while True:
        await asyncio.sleep(config.GUIDE_WEEKLY_REFRESH_CHECK_INTERVAL_SECONDS)
        try:
            processed = await service.process_weekly_refresh_due_users(
                batch_size=config.GUIDE_WEEKLY_REFRESH_CHECK_BATCH_SIZE
            )
            if processed:
                logger.info("weekly_guide_refresh_due_notified", extra={"user_count": processed})
        except Exception as exc:  # noqa: BLE001
            logger.warning("weekly_guide_refresh_loop_error", extra={"error": str(exc)})


@asynccontextmanager
async def lifespan(application: FastAPI):
    await _run_migrations()
    session_task = asyncio.create_task(_session_auto_close_loop())
    weekly_refresh_task = asyncio.create_task(_guide_weekly_refresh_loop())
    depletion_task = asyncio.create_task(_depletion_auto_disable_loop())
    try:
        yield
    finally:
        session_task.cancel()
        weekly_refresh_task.cancel()
        depletion_task.cancel()
        try:
            await session_task
        except asyncio.CancelledError:
            pass
        try:
            await weekly_refresh_task
        except asyncio.CancelledError:
            pass
        try:
            await depletion_task
        except asyncio.CancelledError:
            pass


if config.SENTRY_DSN:
    sentry_sdk.init(
        dsn=config.SENTRY_DSN,
        integrations=[StarletteIntegration(), FastApiIntegration()],
        traces_sample_rate=config.SENTRY_TRACES_SAMPLE_RATE,
        environment=config.ENV,
    )


class RequestIDMiddleware(BaseHTTPMiddleware):
    """REQ-105: 모든 요청에 X-Request-ID를 생성/전파하고 응답 헤더에 포함.
    REQ-113~116: 요청 처리 시간을 측정하여 X-Process-Time 헤더로 반환."""

    async def dispatch(self, request: Request, call_next) -> Response:  # type: ignore[override]
        request_id = request.headers.get("x-request-id") or str(uuid.uuid4())
        request.state.request_id = request_id
        start = time.perf_counter()
        response = await call_next(request)
        elapsed_ms = (time.perf_counter() - start) * 1000
        response.headers["X-Request-ID"] = request_id
        response.headers["X-Process-Time"] = f"{elapsed_ms:.1f}ms"
        if elapsed_ms > 3000:
            logger.warning(
                "slow_request",
                extra={
                    "path": request.url.path,
                    "method": request.method,
                    "elapsed_ms": round(elapsed_ms, 1),
                    "request_id": request_id,
                },
            )
        return response


_is_prod = config.ENV == Env.PROD

app = FastAPI(
    lifespan=lifespan,
    default_response_class=ORJSONResponse,
    docs_url=None if _is_prod else "/api/docs",
    redoc_url=None if _is_prod else "/api/redoc",
    openapi_url=None if _is_prod else "/api/openapi.json",
)
app.add_middleware(RequestIDMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[config.FRONTEND_ORIGIN] if config.FRONTEND_ORIGIN else [],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
initialize_tortoise(app)

app.include_router(v1_routers)
app.include_router(v2_routers)


@app.get("/health", include_in_schema=False)
async def health_check() -> dict[str, str]:
    return {"status": "ok"}


def _error_response(
    status_code: int,
    code: str,
    message: str,
    *,
    detail=None,
    action_hint: str | None = None,
    retryable: bool = False,
    request_id: str | None = None,
) -> ORJSONResponse:
    return ORJSONResponse(
        status_code=status_code,
        content=ApiError(
            code=code,
            message=message,
            detail=detail,
            action_hint=action_hint,
            retryable=retryable,
            request_id=request_id,
            timestamp=datetime.now(UTC),
        ).model_dump(mode="json"),
    )


def _get_request_id(request: Request) -> str | None:
    return getattr(request.state, "request_id", None) or request.headers.get("x-request-id")


@app.exception_handler(AppException)
async def app_exception_handler(request: Request, exc: AppException) -> ORJSONResponse:
    if _is_prod and exc.developer_message:
        logger.warning(
            "app_exception",
            extra={
                "code": exc.code,
                "developer_message": exc.developer_message,
                "request_id": _get_request_id(request),
            },
        )
    return _error_response(
        exc.http_status,
        exc.code,
        exc.user_message,
        detail=None if _is_prod else exc.developer_message,
        action_hint=exc.action_hint,
        retryable=exc.retryable,
        request_id=_get_request_id(request),
    )


@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException) -> ORJSONResponse:
    code_map = {
        status.HTTP_400_BAD_REQUEST: ErrorCode.VALIDATION_ERROR,
        status.HTTP_401_UNAUTHORIZED: ErrorCode.AUTH_INVALID_TOKEN,
        status.HTTP_403_FORBIDDEN: ErrorCode.AUTH_FORBIDDEN,
        status.HTTP_404_NOT_FOUND: ErrorCode.RESOURCE_NOT_FOUND,
        status.HTTP_409_CONFLICT: ErrorCode.STATE_CONFLICT,
        status.HTTP_413_CONTENT_TOO_LARGE: ErrorCode.FILE_TOO_LARGE,
        status.HTTP_429_TOO_MANY_REQUESTS: ErrorCode.RATE_LIMITED,
        status.HTTP_503_SERVICE_UNAVAILABLE: ErrorCode.QUEUE_UNAVAILABLE,
    }
    code = code_map.get(exc.status_code, ErrorCode.INTERNAL_ERROR)
    message = exc.detail if isinstance(exc.detail, str) else str(exc.detail)
    return _error_response(
        exc.status_code,
        code,
        message,
        request_id=_get_request_id(request),
    )


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError) -> ORJSONResponse:
    def _safe(v: object) -> object:
        if isinstance(v, dict):
            return {k: _safe(val) for k, val in v.items()}
        if isinstance(v, list | tuple):
            return [_safe(i) for i in v]
        if isinstance(v, str | int | float | bool | type(None)):
            return v
        return str(v)

    return _error_response(
        status.HTTP_422_UNPROCESSABLE_ENTITY,
        ErrorCode.VALIDATION_ERROR,
        "입력값 검증에 실패했습니다.",
        detail=[_safe(e) for e in exc.errors()],
        action_hint="입력 항목 수정 후 다시 시도",
        request_id=_get_request_id(request),
    )


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception) -> ORJSONResponse:
    return _error_response(
        status.HTTP_500_INTERNAL_SERVER_ERROR,
        ErrorCode.INTERNAL_ERROR,
        "서버 내부 오류가 발생했습니다.",
        retryable=True,
        request_id=_get_request_id(request),
    )
