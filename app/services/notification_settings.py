from app.dtos.notifications import NotificationSettingUpdateRequest
from app.models.notification_settings import UserNotificationSetting
from app.models.users import User


class NotificationSettingService:
    async def get_or_create(self, *, user: User) -> UserNotificationSetting:
        setting, _ = await UserNotificationSetting.get_or_create(user_id=user.id)
        return setting

    async def update(self, *, user: User, data: NotificationSettingUpdateRequest) -> UserNotificationSetting:
        setting = await self.get_or_create(user=user)
        update = data.model_dump(exclude_none=True)
        update_fields: list[str] = []
        for field, value in update.items():
            setattr(setting, field, value)
            update_fields.append(field)
        if update_fields:
            update_fields.append("updated_at")
            await setting.save(update_fields=update_fields)
        return setting
