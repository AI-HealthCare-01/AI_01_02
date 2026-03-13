from unittest.mock import AsyncMock, patch

from tortoise.contrib.test import TestCase

from app.models.health_profiles import UserHealthProfile
from app.models.ocr import Document, DocumentType, OcrJob, OcrJobStatus
from app.models.psych_drugs import PsychDrug
from app.models.users import Gender, User
from app.services.analysis import AnalysisService


class TestAnalysisServiceAllergyAlerts(TestCase):
    async def _create_user(self, *, email: str, phone_number: str) -> User:
        return await User.create(
            email=email,
            hashed_password="hashed-password",
            name="알러지테스터",
            gender=Gender.MALE,
            birthday="1990-01-01",
            phone_number=phone_number,
        )

    async def _create_profile(self, *, user: User, drug_allergies: list[str]) -> UserHealthProfile:
        return await UserHealthProfile.create(
            user=user,
            height_cm=175.0,
            weight_kg=70.0,
            drug_allergies=drug_allergies,
            exercise_frequency_per_week=2,
            pc_hours_per_day=5,
            smartphone_hours_per_day=3,
            caffeine_cups_per_day=2,
            smoking=0,
            alcohol_frequency_per_week=1,
            bed_time="23:00",
            wake_time="07:00",
            sleep_latency_minutes=20,
            night_awakenings_per_week=1,
            daytime_sleepiness=3,
            appetite_level=6,
            meal_regular=True,
            bmi=22.86,
            sleep_time_hours=8.0,
            caffeine_mg=200,
            digital_time_hours=8,
        )

    async def _create_ocr_job(self, *, user: User, drug_name: str) -> OcrJob:
        document = await Document.create(
            user=user,
            document_type=DocumentType.PRESCRIPTION,
            file_name="prescription.png",
            temp_storage_key="documents/test/prescription.png",
            file_size=100,
            mime_type="image/png",
        )
        return await OcrJob.create(
            user=user,
            document=document,
            status=OcrJobStatus.SUCCEEDED,
            structured_result={"extracted_medications": [{"drug_name": drug_name}]},
        )

    async def test_alerts_when_allergy_is_ingredient_and_prescription_is_product(self):
        user = await self._create_user(email="ingredient-allergy@example.com", phone_number="01090009000")
        await self._create_profile(user=user, drug_allergies=["메틸페니데이트"])
        await self._create_ocr_job(user=user, drug_name="콘서타OROS서방정18mg")
        await PsychDrug.create(
            ingredient_name="메틸페니데이트",
            product_name="콘서타OROS서방정18mg",
            side_effects="",
            precautions="",
        )

        with patch("app.services.analysis.generate_allergy_medication_guidance", new=AsyncMock(return_value="경고")):
            summary = await AnalysisService().get_summary(user=user)

        assert len(summary["allergy_alerts"]) == 1
        assert summary["allergy_alerts"][0]["medication_name"] == "콘서타OROS서방정18mg"
        assert summary["allergy_alerts"][0]["allergy_substance"] == "메틸페니데이트"
        assert summary["emergency_alerts"][0]["title"] == "알레르기 약물 충돌 가능성"
        assert summary["emergency_alerts"][0]["alert_key"] == "ALLERGY::메틸페니데이트::콘서타OROS서방정18mg"

    async def test_alerts_when_allergy_and_prescription_are_different_products_of_same_ingredient(self):
        user = await self._create_user(email="product-allergy@example.com", phone_number="01090009001")
        await self._create_profile(user=user, drug_allergies=["메타데이트CD서방캡슐10mg"])
        await self._create_ocr_job(user=user, drug_name="콘서타OROS서방정18mg")
        await PsychDrug.create(
            ingredient_name="메틸페니데이트",
            product_name="메타데이트CD서방캡슐10mg",
            side_effects="",
            precautions="",
        )
        await PsychDrug.create(
            ingredient_name="메틸페니데이트",
            product_name="콘서타OROS서방정18mg",
            side_effects="",
            precautions="",
        )

        with patch("app.services.analysis.generate_allergy_medication_guidance", new=AsyncMock(return_value="경고")):
            summary = await AnalysisService().get_summary(user=user)

        assert len(summary["allergy_alerts"]) == 1
        assert summary["allergy_alerts"][0]["allergy_substance"] == "메틸페니데이트"
        assert summary["allergy_alerts"][0]["matched_ingredient"] == "메틸페니데이트"
        assert summary["emergency_alerts"][0]["alert_key"] == "ALLERGY::메틸페니데이트::콘서타OROS서방정18mg"
