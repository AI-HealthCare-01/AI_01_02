from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import ORJSONResponse as Response

from app.dependencies.security import get_request_user
from app.dtos.health_profiles import HealthProfileResponse, HealthProfileUpsertRequest
from app.dtos.users import UserInfoResponse, UserUpdateRequest
from app.services.health_profiles import HealthProfileService
from app.models.users import User
from app.services.users import UserManageService

user_router = APIRouter(prefix="/users", tags=["users"])


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
) -> Response:
    return Response(_serialize_user_info(user).model_dump(), status_code=status.HTTP_200_OK)


@user_router.patch("/me", response_model=UserInfoResponse, status_code=status.HTTP_200_OK)
async def update_user_me_info(
    update_data: UserUpdateRequest,
    user: Annotated[User, Depends(get_request_user)],
    user_manage_service: Annotated[UserManageService, Depends(UserManageService)],
) -> Response:
    updated_user = await user_manage_service.update_user(user=user, data=update_data)
    return Response(_serialize_user_info(updated_user).model_dump(), status_code=status.HTTP_200_OK)


@user_router.put("/me/health-profile", response_model=HealthProfileResponse, status_code=status.HTTP_200_OK)
async def upsert_my_health_profile(
    request: HealthProfileUpsertRequest,
    user: Annotated[User, Depends(get_request_user)],
    health_profile_service: Annotated[HealthProfileService, Depends(HealthProfileService)],
) -> Response:
    profile = await health_profile_service.upsert_profile(user=user, request=request)
    return Response(health_profile_service.serialize(profile).model_dump(), status_code=status.HTTP_200_OK)


@user_router.get("/me/health-profile", response_model=HealthProfileResponse, status_code=status.HTTP_200_OK)
async def get_my_health_profile(
    user: Annotated[User, Depends(get_request_user)],
    health_profile_service: Annotated[HealthProfileService, Depends(HealthProfileService)],
) -> Response:
    profile = await health_profile_service.get_profile(user=user)
    if not profile:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="건강 프로필이 없습니다.")
    return Response(health_profile_service.serialize(profile).model_dump(), status_code=status.HTTP_200_OK)
