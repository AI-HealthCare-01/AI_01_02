from app.models.guides import GuideJob
from app.models.ocr import OcrJob


class GuideRepository:
    async def get_user_ocr_job(self, *, ocr_job_id: int, user_id: int) -> OcrJob | None:
        return await OcrJob.get_or_none(id=ocr_job_id, user_id=user_id)

    async def create_job(self, *, user_id: int, ocr_job_id: int, max_retries: int) -> GuideJob:
        return await GuideJob.create(user_id=user_id, ocr_job_id=ocr_job_id, max_retries=max_retries)

    async def get_user_job(self, *, job_id: int, user_id: int) -> GuideJob | None:
        return await GuideJob.get_or_none(id=job_id, user_id=user_id)
