from typing import Annotated

from fastapi import APIRouter, Cookie, Depends, Response, status
from fastapi.responses import ORJSONResponse
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.dependencies.security import get_request_user
from app.dtos.users import UserInfoResponse, UserUpdateRequest
from app.models.users import User
from app.services.jwt import JwtService
from app.services.users import UserManageService

user_router = APIRouter(prefix="/users", tags=["users"])
_bearer = HTTPBearer()


def _serialize_user_info(user: User) -> UserInfoResponse:
    return UserInfoResponse(
        id=str(user.id),
        name=user.name,
        email=user.email,
        phone_number=user.phone_number,
        birthday=user.birthday,
        gender=user.gender,
        created_at=user.created_at,
    )


@user_router.get("/me", response_model=UserInfoResponse, status_code=status.HTTP_200_OK)
async def user_me_info(
    user: Annotated[User, Depends(get_request_user)],
) -> ORJSONResponse:
    return ORJSONResponse(_serialize_user_info(user).model_dump(), status_code=status.HTTP_200_OK)


@user_router.patch("/me", response_model=UserInfoResponse, status_code=status.HTTP_200_OK)
async def update_user_me_info(
    update_data: UserUpdateRequest,
    user: Annotated[User, Depends(get_request_user)],
    user_manage_service: Annotated[UserManageService, Depends(UserManageService)],
) -> ORJSONResponse:
    updated_user = await user_manage_service.update_user(user=user, data=update_data)
    return ORJSONResponse(_serialize_user_info(updated_user).model_dump(), status_code=status.HTTP_200_OK)


@user_router.delete("/me", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user_me(
    user: Annotated[User, Depends(get_request_user)],
    credential: Annotated[HTTPAuthorizationCredentials, Depends(_bearer)],
    user_manage_service: Annotated[UserManageService, Depends(UserManageService)],
    refresh_token: Annotated[str | None, Cookie()] = None,
) -> Response:
    jwt_service = JwtService()
    access_jti: str = jwt_service.verify_jwt(credential.credentials, token_type="access").payload.get("jti", "")

    refresh_jti: str | None = None
    if refresh_token:
        try:
            refresh_jti = jwt_service.verify_jwt(refresh_token, token_type="refresh").payload.get("jti")
        except Exception:  # noqa: BLE001
            pass

    await user_manage_service.deactivate_user(user=user, access_jti=access_jti, refresh_jti=refresh_jti)
    resp = Response(status_code=status.HTTP_204_NO_CONTENT)
    resp.delete_cookie(key="refresh_token")
    return resp
