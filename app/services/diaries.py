from datetime import date

from app.models.diaries import DailyDiary
from app.models.users import User


class DiaryService:
    async def upsert(self, user: User, diary_date: date, content: str) -> DailyDiary:
        diary, _ = await DailyDiary.get_or_create(
            user=user,
            date=diary_date,
            defaults={"content": content},
        )
        if diary.content != content:
            diary.content = content
            await diary.save(update_fields=["content", "updated_at"])
        return diary

    async def get_by_date(self, user: User, diary_date: date) -> DailyDiary | None:
        return await DailyDiary.get_or_none(user=user, date=diary_date)

    async def list_range(
        self, user: User, start: date, end: date,
    ) -> list[DailyDiary]:
        return await DailyDiary.filter(
            user=user, date__gte=start, date__lte=end,
        ).order_by("date")
