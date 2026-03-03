from app.dtos.profiles import HealthProfileUpsertRequest
from app.models.profiles import HealthProfile
from app.models.users import User


class HealthProfileService:
    async def upsert_profile(self, *, user: User, data: HealthProfileUpsertRequest) -> HealthProfile:
        profile, _ = await HealthProfile.update_or_create(
            defaults={
                "basic_info": data.basic_info.model_dump(),
                "lifestyle_input": data.lifestyle_input.model_dump(),
                "sleep_input": data.sleep_input.model_dump(),
                "nutrition_input": data.nutrition_input.model_dump(),
            },
            user_id=user.id,
        )
        return profile

    async def get_profile(self, *, user: User) -> HealthProfile | None:
        return await HealthProfile.get_or_none(user_id=user.id)
