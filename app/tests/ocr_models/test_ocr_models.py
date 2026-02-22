from tortoise.contrib.test import TestCase

from app.models.ocr import Document, DocumentType, OcrJob, OcrJobStatus, OcrResult
from app.models.users import Gender, User


class TestOcrModels(TestCase):
    async def _create_user(self, *, email: str, phone_number: str) -> User:
        return await User.create(
            email=email,
            hashed_password="hashed-password",
            name="OCR테스터",
            gender=Gender.MALE,
            birthday="1990-01-01",
            phone_number=phone_number,
        )

    async def test_create_document_and_job_defaults(self):
        user = await self._create_user(email="ocr_document@example.com", phone_number="01011112222")

        document = await Document.create(
            user=user,
            document_type=DocumentType.PRESCRIPTION,
            file_name="prescription_001.png",
            file_path="/tmp/prescription_001.png",
            file_size=1024,
            mime_type="image/png",
        )
        job = await OcrJob.create(user=user, document=document)

        assert document.user_id == user.id
        assert job.user_id == user.id
        assert job.document_id == document.id
        assert job.status == OcrJobStatus.QUEUED
        assert job.error_message is None

    async def test_create_ocr_result_one_to_one(self):
        user = await self._create_user(email="ocr_result@example.com", phone_number="01033334444")

        document = await Document.create(
            user=user,
            document_type=DocumentType.MEDICAL_RECORD,
            file_name="medical_record_001.pdf",
            file_path="/tmp/medical_record_001.pdf",
            file_size=2048,
            mime_type="application/pdf",
        )
        job = await OcrJob.create(user=user, document=document, status=OcrJobStatus.PROCESSING)

        result = await OcrResult.create(
            job=job,
            extracted_text="복약 지시: 하루 두 번 복용",
            structured_data={"medications": [{"name": "A", "frequency": "BID"}]},
        )

        await job.fetch_related("result")

        assert result.job_id == job.id
        assert job.result.id == result.id
        assert job.result.structured_data["medications"][0]["name"] == "A"
