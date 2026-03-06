from typing import Annotated

from fastapi import APIRouter, Depends, status
from fastapi.responses import ORJSONResponse as Response

from app.core.exceptions import AppException, ErrorCode
from app.dependencies.security import get_request_user
from app.dtos.profiles import HealthProfileResponse, HealthProfileUpsertRequest
from app.models.users import User
from app.services.profiles import HealthProfileService

profile_router = APIRouter(prefix="/profiles", tags=["profiles"])


def _serialize(profile) -> HealthProfileResponse:  # type: ignore[no-untyped-def]
    return HealthProfileResponse(
        id=str(profile.id),
        user_id=str(profile.user_id),
        basic_info=profile.basic_info,
        lifestyle_input=profile.lifestyle_input,
        sleep_input=profile.sleep_input,
        nutrition_input=profile.nutrition_input,
        created_at=profile.created_at,
        updated_at=profile.updated_at,
    )


@profile_router.put("/health", response_model=HealthProfileResponse, status_code=status.HTTP_200_OK)
async def upsert_health_profile(
    data: HealthProfileUpsertRequest,
    user: Annotated[User, Depends(get_request_user)],
    service: Annotated[HealthProfileService, Depends(HealthProfileService)],
) -> Response:
    profile = await service.upsert_profile(user=user, data=data)
    return Response(_serialize(profile).model_dump(), status_code=status.HTTP_200_OK)


@profile_router.get("/health", response_model=HealthProfileResponse, status_code=status.HTTP_200_OK)
async def get_health_profile(
    user: Annotated[User, Depends(get_request_user)],
    service: Annotated[HealthProfileService, Depends(HealthProfileService)],
) -> Response:
    profile = await service.get_profile(user=user)
    if not profile:
        raise AppException(ErrorCode.RESOURCE_NOT_FOUND, developer_message="건강 프로필을 찾을 수 없습니다.")
    return Response(_serialize(profile).model_dump(), status_code=status.HTTP_200_OK)
