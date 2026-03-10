from typing import Any

from app.models.health_profiles import UserHealthProfile


class HealthProfileRepository:
    async def get_by_user_id(self, *, user_id: int) -> UserHealthProfile | None:
        return await UserHealthProfile.get_or_none(user_id=user_id)

    async def upsert_by_user_id(self, *, user_id: int, payload: dict[str, Any]) -> UserHealthProfile:
        await UserHealthProfile.update_or_create(defaults=payload, user_id=user_id)
        profile = await UserHealthProfile.get_or_none(user_id=user_id)
        if profile is None:
            raise RuntimeError("Failed to upsert health profile.")
        return profile
