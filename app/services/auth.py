from collections.abc import Awaitable
from typing import cast

from pydantic import EmailStr
from redis.asyncio import Redis
from redis.exceptions import RedisError
from tortoise.transactions import in_transaction

from app.core import config
from app.core.exceptions import AppException, ErrorCode
from app.core.logger import default_logger as logger
from app.dtos.auth import LoginRequest, SignUpRequest
from app.models.users import User
from app.repositories.user_repository import UserRepository
from app.services.jwt import JwtService
from app.utils.common import normalize_phone_number
from app.utils.jwt.tokens import AccessToken, RefreshToken
from app.utils.security import hash_password, verify_password

TOKEN_BLACKLIST_PREFIX = "token:blacklist:"
TOKEN_BLACKLIST_TTL_SECONDS = (config.REFRESH_TOKEN_EXPIRE_MINUTES + 1) * 60

_redis_client: Redis | None = None


def _get_redis_client() -> Redis:
    global _redis_client
    if _redis_client is None:
        _redis_client = Redis(
            host=config.REDIS_HOST,
            port=config.REDIS_PORT,
            db=config.REDIS_DB,
            password=config.REDIS_PASSWORD,
            decode_responses=True,
            socket_connect_timeout=config.REDIS_SOCKET_TIMEOUT_SECONDS,
            socket_timeout=config.REDIS_SOCKET_TIMEOUT_SECONDS,
        )
    return _redis_client


async def blacklist_jti(jti: str, ttl_seconds: int = TOKEN_BLACKLIST_TTL_SECONDS) -> None:
    client = _get_redis_client()
    try:
        await cast(Awaitable, client.setex(f"{TOKEN_BLACKLIST_PREFIX}{jti}", ttl_seconds, "1"))
    except RedisError:
        logger.warning("failed to blacklist jti=%s — token revocation may not take effect", jti, exc_info=True)


async def is_jti_blacklisted(jti: str) -> bool:
    client = _get_redis_client()
    try:
        result = await cast(Awaitable, client.exists(f"{TOKEN_BLACKLIST_PREFIX}{jti}"))
        return bool(result)
    except RedisError:
        # Fail-closed: Redis 장애 시 모든 토큰을 블랙리스트 처리하여 보안 유지.
        # 이로 인해 Redis 장애 동안 모든 인증 요청이 거부됨.
        logger.error(
            "redis_jti_check_failed — fail-closed: all tokens treated as blacklisted",
            extra={"jti": jti},
            exc_info=True,
        )
        return True


class AuthService:
    def __init__(self):
        self.user_repo = UserRepository()
        self.jwt_service = JwtService()

    async def signup(self, data: SignUpRequest) -> User:
        # 이메일 중복 체크
        await self.check_email_exists(data.email)

        # 입력받은 휴대폰 번호를 노말라이즈
        normalized_phone_number = normalize_phone_number(data.phone_number)

        # 휴대폰 번호 중복 체크
        await self.check_phone_number_exists(normalized_phone_number)

        # 유저 생성
        async with in_transaction():
            user = await self.user_repo.create_user(
                email=data.email,
                hashed_password=hash_password(data.password),  # 해시화된 비밀번호를 사용
                name=data.name,
                phone_number=normalized_phone_number,
                gender=data.gender,
                birthday=data.birth_date,
            )

            return user

    async def authenticate(self, data: LoginRequest) -> User:
        # 이메일로 사용자 조회
        email = str(data.email)
        user = await self.user_repo.get_user_by_email(email)
        if not user:
            raise AppException(
                ErrorCode.AUTH_INVALID_CREDENTIALS, developer_message="이메일 또는 비밀번호가 올바르지 않습니다."
            )

        # 비밀번호 검증
        if not verify_password(data.password, user.hashed_password):
            raise AppException(
                ErrorCode.AUTH_INVALID_CREDENTIALS, developer_message="이메일 또는 비밀번호가 올바르지 않습니다."
            )

        # 활성 사용자 체크
        if not user.is_active:
            raise AppException(ErrorCode.AUTH_ACCOUNT_INACTIVE)

        return user

    async def login(self, user: User) -> dict[str, AccessToken | RefreshToken]:
        await self.user_repo.update_last_login(user.id)
        return self.jwt_service.issue_jwt_pair(user)

    async def check_email_exists(self, email: str | EmailStr, *, exclude_user_id: int | None = None) -> None:
        if await self.user_repo.exists_by_email(str(email), exclude_user_id=exclude_user_id):
            raise AppException(ErrorCode.DUPLICATE_EMAIL)

    async def check_phone_number_exists(self, phone_number: str, *, exclude_user_id: int | None = None) -> None:
        if await self.user_repo.exists_by_phone_number(phone_number, exclude_user_id=exclude_user_id):
            raise AppException(ErrorCode.DUPLICATE_PHONE)

    async def deactivate_user(self, user: User, *, access_jti: str, refresh_jti: str | None) -> None:
        async with in_transaction():
            await self.user_repo.deactivate_user(user.id)
        await blacklist_jti(access_jti)
        if refresh_jti:
            await blacklist_jti(refresh_jti)
