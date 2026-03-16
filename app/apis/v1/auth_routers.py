from datetime import UTC, datetime
from typing import Annotated

from fastapi import APIRouter, Cookie, Depends, status
from fastapi.responses import ORJSONResponse as Response
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.core import config
from app.core.config import Env
from app.core.exceptions import AppException, ErrorCode
from app.core.logger import default_logger as logger
from app.dtos.auth import LoginRequest, LoginResponse, SignUpRequest, TokenRefreshResponse
from app.services.auth import AuthService, blacklist_jti
from app.services.jwt import JwtService

auth_router = APIRouter(prefix="/auth", tags=["auth"])


@auth_router.post("/signup", status_code=status.HTTP_201_CREATED)
async def signup(
    request: SignUpRequest,
    auth_service: Annotated[AuthService, Depends(AuthService)],
) -> Response:
    await auth_service.signup(request)
    return Response(content={"detail": "회원가입이 성공적으로 완료되었습니다."}, status_code=status.HTTP_201_CREATED)


@auth_router.post("/login", response_model=LoginResponse, status_code=status.HTTP_200_OK)
async def login(
    request: LoginRequest,
    auth_service: Annotated[AuthService, Depends(AuthService)],
) -> Response:
    user = await auth_service.authenticate(request)
    tokens = await auth_service.login(user)
    refresh_token = tokens["refresh_token"]
    refresh_token_exp = datetime.fromtimestamp(refresh_token.payload["exp"], tz=UTC)
    resp = Response(
        content=LoginResponse(access_token=str(tokens["access_token"])).model_dump(), status_code=status.HTTP_200_OK
    )
    resp.set_cookie(
        key="refresh_token",
        value=str(refresh_token),
        httponly=True,
        secure=config.ENV == Env.PROD,
        samesite="lax",
        domain=config.COOKIE_DOMAIN or None,
        expires=refresh_token_exp,
        max_age=config.REFRESH_TOKEN_EXPIRE_MINUTES * 60,
    )
    return resp


@auth_router.post("/token/refresh", response_model=TokenRefreshResponse, status_code=status.HTTP_200_OK)
async def token_refresh(
    jwt_service: Annotated[JwtService, Depends(JwtService)],
    refresh_token: Annotated[str | None, Cookie()] = None,
) -> Response:
    if not refresh_token:
        raise AppException(ErrorCode.AUTH_INVALID_TOKEN, developer_message="Refresh token is missing.")
    tokens = await jwt_service.refresh_jwt(refresh_token)
    new_refresh_token = tokens["refresh_token"]
    refresh_token_exp = datetime.fromtimestamp(new_refresh_token.payload["exp"], tz=UTC)
    resp = Response(
        content=TokenRefreshResponse(access_token=str(tokens["access_token"])).model_dump(),
        status_code=status.HTTP_200_OK,
    )
    resp.set_cookie(
        key="refresh_token",
        value=str(new_refresh_token),
        httponly=True,
        secure=config.ENV == Env.PROD,
        samesite="lax",
        domain=config.COOKIE_DOMAIN or None,
        expires=refresh_token_exp,
        max_age=config.REFRESH_TOKEN_EXPIRE_MINUTES * 60,
    )
    return resp


@auth_router.post("/logout", status_code=status.HTTP_200_OK)
async def logout(
    jwt_service: Annotated[JwtService, Depends(JwtService)],
    credential: Annotated[HTTPAuthorizationCredentials | None, Depends(HTTPBearer(auto_error=False))] = None,
    refresh_token: Annotated[str | None, Cookie()] = None,
) -> Response:
    if credential:
        try:
            verified_at = jwt_service.verify_jwt(token=credential.credentials, token_type="access")
            at_jti = verified_at.payload.get("jti", "")
            if at_jti:
                await blacklist_jti(at_jti)
        except AppException as exc:
            logger.debug("logout_access_token_error", extra={"code": exc.code})
    if refresh_token:
        try:
            verified_rt = jwt_service.verify_jwt(token=refresh_token, token_type="refresh")
            rt_jti = verified_rt.payload.get("jti", "")
            if rt_jti:
                await blacklist_jti(rt_jti)
        except AppException as exc:
            logger.debug("logout_token_error", extra={"code": exc.code})
    resp = Response(content={"detail": "로그아웃되었습니다."}, status_code=status.HTTP_200_OK)
    resp.delete_cookie(
        key="refresh_token",
        httponly=True,
        secure=config.ENV == Env.PROD,
        samesite="lax",
        domain=config.COOKIE_DOMAIN or None,
    )
    return resp
