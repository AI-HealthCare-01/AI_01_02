from tortoise.transactions import in_transaction

from app.dtos.users import UserUpdateRequest
from app.models.users import User
from app.repositories.user_repository import UserRepository
from app.services.auth import AuthService
from app.utils.common import normalize_phone_number


class UserManageService:
    def __init__(self):
        self.repo = UserRepository()
        self.auth_service = AuthService()

    async def update_user(self, user: User, data: UserUpdateRequest) -> User:
        update_payload = data.model_dump(exclude_none=True)
        if not update_payload:
            return user
        if data.email:
            await self.auth_service.check_email_exists(data.email, exclude_user_id=user.id)
        if data.phone_number:
            normalized_phone_number = normalize_phone_number(data.phone_number)
            await self.auth_service.check_phone_number_exists(normalized_phone_number, exclude_user_id=user.id)
            data.phone_number = normalized_phone_number
            update_payload["phone_number"] = normalized_phone_number
        async with in_transaction():
            await self.repo.update_instance(user=user, data=update_payload)
            await user.refresh_from_db()
        return user

    async def deactivate_user(self, user: User, *, access_jti: str, refresh_jti: str | None) -> None:
        await self.auth_service.deactivate_user(user, access_jti=access_jti, refresh_jti=refresh_jti)
