from typing import Literal, overload

from app.core.exceptions import AppException, ErrorCode
from app.models.users import User
from app.utils.jwt.exceptions import ExpiredTokenError, TokenError
from app.utils.jwt.tokens import AccessToken, RefreshToken


class JwtService:
    access_token_class = AccessToken
    refresh_token_class = RefreshToken

    def create_access_token(self, user: User) -> AccessToken:
        return self.access_token_class.for_user(user)

    def create_refresh_token(self, user: User) -> RefreshToken:
        return self.refresh_token_class.for_user(user)

    @overload
    def verify_jwt(
        self,
        token: str,
        token_type: Literal["access"],
    ) -> AccessToken: ...

    @overload
    def verify_jwt(
        self,
        token: str,
        token_type: Literal["refresh"],
    ) -> RefreshToken: ...

    def verify_jwt(self, token: str, token_type: Literal["access", "refresh"]) -> AccessToken | RefreshToken:
        token_class: type[AccessToken | RefreshToken]
        if token_type == "access":
            token_class = self.access_token_class
        else:
            token_class = self.refresh_token_class

        try:
            verified = token_class(token=token)
            return verified
        except ExpiredTokenError as err:
            raise AppException(
                ErrorCode.AUTH_TOKEN_EXPIRED, developer_message=f"{token_type} token has expired."
            ) from err
        except TokenError as err:
            raise AppException(ErrorCode.AUTH_INVALID_TOKEN, developer_message="Provided invalid token.") from err

    async def refresh_jwt(self, refresh_token: str) -> dict[str, AccessToken | RefreshToken]:
        from app.services.auth import blacklist_jti, is_jti_blacklisted

        verified_rt = self.verify_jwt(token=refresh_token, token_type="refresh")
        old_jti = verified_rt.payload.get("jti", "")
        if old_jti and await is_jti_blacklisted(old_jti):
            raise AppException(ErrorCode.AUTH_INVALID_TOKEN, developer_message="Refresh token has been revoked.")

        user_id = verified_rt.payload.get("user_id")
        if not user_id:
            raise AppException(ErrorCode.AUTH_INVALID_TOKEN, developer_message="Refresh token missing user_id claim.")
        if old_jti:
            await blacklist_jti(old_jti)

        new_rt = RefreshToken()
        new_rt["user_id"] = user_id
        new_at = new_rt.access_token
        return {"access_token": new_at, "refresh_token": new_rt}

    def issue_jwt_pair(self, user: User) -> dict[str, AccessToken | RefreshToken]:
        rt = self.create_refresh_token(user)
        at = rt.access_token
        return {"access_token": at, "refresh_token": rt}
