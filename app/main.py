import asyncio
import uuid
from contextlib import asynccontextmanager
from datetime import UTC, datetime

import sentry_sdk
from fastapi import FastAPI, HTTPException, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import ORJSONResponse
from sentry_sdk.integrations.fastapi import FastApiIntegration
from sentry_sdk.integrations.starlette import StarletteIntegration
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response

from app.apis.v1 import v1_routers
from app.apis.v2 import v2_routers
from app.core import config
from app.core.exceptions import AppException, ErrorCode
from app.core.logger import default_logger as logger
from app.db.databases import initialize_tortoise
from app.dtos.errors import ApiError
from app.services.chat import close_inactive_sessions

_SESSION_CLOSE_INTERVAL_SECONDS = 60


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
    from tortoise import Tortoise
    from pathlib import Path
    import importlib

    migration_dir = Path(__file__).parent / "db" / "migrations" / "models"
    conn = Tortoise.get_connection("default")

    result = await conn.execute_query("SELECT version FROM aerich ORDER BY id")
    applied = {row["version"] for row in result[1]}

    for migration_file in sorted(migration_dir.glob("*.py")):
        name = migration_file.name
        if name in applied or name == "__init__.py":
            continue
        spec = importlib.util.spec_from_file_location(name, migration_file)
        mod = importlib.util.module_from_spec(spec)  # type: ignore[arg-type]
        spec.loader.exec_module(mod)  # type: ignore[union-attr]
        sql: str = await mod.upgrade(conn)
        if sql and sql.strip():
            for statement in sql.strip().split(";"):
                stmt = statement.strip()
                if stmt:
                    try:
                        await conn.execute_script(stmt)
                    except Exception:  # noqa: BLE001
                        pass
        await conn.execute_query(
            "INSERT IGNORE INTO aerich (version, app) VALUES (%s, %s)", [name, "models"]
        )
        logger.info("migration applied: %s", name)


@asynccontextmanager
async def lifespan(application: FastAPI):
    await _run_migrations()
    task = asyncio.create_task(_session_auto_close_loop())
    try:
        yield
    finally:
        task.cancel()
        try:
            await task
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
    """REQ-105: 모든 요청에 X-Request-ID를 생성/전파하고 응답 헤더에 포함."""

    async def dispatch(self, request: Request, call_next) -> Response:  # type: ignore[override]
        request_id = request.headers.get("x-request-id") or str(uuid.uuid4())
        request.state.request_id = request_id
        response = await call_next(request)
        response.headers["X-Request-ID"] = request_id
        return response


app = FastAPI(
    lifespan=lifespan,
    default_response_class=ORJSONResponse, docs_url="/api/docs", redoc_url="/api/redoc", openapi_url="/api/openapi.json"
)
app.add_middleware(RequestIDMiddleware)
initialize_tortoise(app)

app.include_router(v1_routers)
app.include_router(v2_routers)


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
    return _error_response(
        exc.http_status,
        exc.code,
        exc.user_message,
        detail=exc.developer_message,
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
        if isinstance(v, (list, tuple)):
            return [_safe(i) for i in v]
        if isinstance(v, (str, int, float, bool, type(None))):
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
