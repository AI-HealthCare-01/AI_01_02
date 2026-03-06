from tortoise.transactions import in_transaction

from app.dtos.users import UserUpdateRequest
from app.models.notifications import NotificationType
from app.models.users import User
from app.repositories.notification_repository import NotificationRepository
from app.repositories.user_repository import UserRepository
from app.services.auth import AuthService
from app.utils.common import normalize_phone_number


class UserManageService:
    def __init__(self):
        self.repo = UserRepository()
        self.auth_service = AuthService()
        self.notification_repo = NotificationRepository()

    async def update_user(self, user: User, data: UserUpdateRequest) -> User:
        update_payload = data.model_dump(exclude_none=True)
        if data.email:
            await self.auth_service.check_email_exists(data.email, exclude_user_id=user.id)
        if data.phone_number:
            normalized_phone_number = normalize_phone_number(data.phone_number)
            await self.auth_service.check_phone_number_exists(normalized_phone_number, exclude_user_id=user.id)
            data.phone_number = normalized_phone_number
            update_payload["phone_number"] = normalized_phone_number
        async with in_transaction():
            await self.repo.update_instance(user=user, data=update_payload)
            if update_payload:
                changed_fields = list(update_payload.keys())
                await self.notification_repo.create_notification(
                    user_id=user.id,
                    notification_type=NotificationType.SYSTEM,
                    title="회원정보 수정 완료",
                    message="회원정보가 정상적으로 수정되었습니다.",
                    payload={"event": "profile_updated", "changed_fields": changed_fields},
                )
            await user.refresh_from_db()
        return user
