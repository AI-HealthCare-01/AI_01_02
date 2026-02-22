from tempfile import TemporaryDirectory
from unittest.mock import patch

from httpx import ASGITransport, AsyncClient
from starlette import status
from tortoise.contrib.test import TestCase

from app.core import config
from app.main import app
from app.models.guides import GuideJob, GuideJobStatus, GuideResult, GuideRiskLevel
from app.models.ocr import OcrJob, OcrJobStatus, OcrResult


class TestGuideApis(TestCase):
    def setUp(self) -> None:
        self._tmp_media_dir = TemporaryDirectory()
        self._media_dir_patcher = patch.object(config, "MEDIA_DIR", self._tmp_media_dir.name)
        self._media_dir_patcher.start()

    def tearDown(self) -> None:
        self._media_dir_patcher.stop()
        self._tmp_media_dir.cleanup()

    async def _signup_and_login(self, client: AsyncClient, *, email: str, phone_number: str) -> str:
        signup_response = await client.post(
            "/api/v1/auth/signup",
            json={
                "email": email,
                "password": "Password123!",
                "name": "GUIDE API 테스트",
                "gender": "MALE",
                "birth_date": "1990-01-01",
                "phone_number": phone_number,
            },
        )
        assert signup_response.status_code == status.HTTP_201_CREATED
        login_response = await client.post("/api/v1/auth/login", json={"email": email, "password": "Password123!"})
        assert login_response.status_code == status.HTTP_200_OK
        return login_response.json()["access_token"]

    async def _create_ocr_job(self, client: AsyncClient, *, access_token: str) -> int:
        headers = {"Authorization": f"Bearer {access_token}"}
        upload_response = await client.post(
            "/api/v1/ocr/documents/upload",
            headers=headers,
            data={"document_type": "PRESCRIPTION"},
            files={"file": ("guide-test.png", b"guide-image-bytes", "image/png")},
        )
        assert upload_response.status_code == status.HTTP_201_CREATED
        document_id = upload_response.json()["id"]

        create_response = await client.post(
            "/api/v1/ocr/jobs",
            headers=headers,
            json={"document_id": document_id},
        )
        assert create_response.status_code == status.HTTP_202_ACCEPTED
        return create_response.json()["job_id"]

    async def _mark_ocr_succeeded(self, *, ocr_job_id: int) -> None:
        ocr_job = await OcrJob.get(id=ocr_job_id)
        ocr_job.status = OcrJobStatus.SUCCEEDED
        await ocr_job.save(update_fields=["status"])
        await OcrResult.create(
            job=ocr_job,
            extracted_text="처방전 OCR 텍스트",
            structured_data={"summary": "ok"},
        )

    async def test_create_guide_job_and_get_status_success(self):
        email = "guide_job_success@example.com"
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            access_token = await self._signup_and_login(client, email=email, phone_number="01083008300")
            headers = {"Authorization": f"Bearer {access_token}"}

            ocr_job_id = await self._create_ocr_job(client, access_token=access_token)
            await self._mark_ocr_succeeded(ocr_job_id=ocr_job_id)

            create_response = await client.post("/api/v1/guides/jobs", headers=headers, json={"ocr_job_id": ocr_job_id})
            assert create_response.status_code == status.HTTP_202_ACCEPTED
            create_body = create_response.json()
            assert create_body["status"] == "QUEUED"
            assert create_body["retry_count"] == 0
            assert create_body["max_retries"] == config.GUIDE_JOB_MAX_RETRIES

            status_response = await client.get(f"/api/v1/guides/jobs/{create_body['job_id']}", headers=headers)

        assert status_response.status_code == status.HTTP_200_OK
        status_body = status_response.json()
        assert status_body["status"] == "QUEUED"
        assert status_body["ocr_job_id"] == ocr_job_id
        assert status_body["failure_code"] is None

    async def test_create_guide_job_when_ocr_not_ready(self):
        email = "guide_job_not_ready@example.com"
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            access_token = await self._signup_and_login(client, email=email, phone_number="01083008301")
            headers = {"Authorization": f"Bearer {access_token}"}
            ocr_job_id = await self._create_ocr_job(client, access_token=access_token)

            response = await client.post("/api/v1/guides/jobs", headers=headers, json={"ocr_job_id": ocr_job_id})

        assert response.status_code == status.HTTP_409_CONFLICT
        assert response.json()["detail"] == "OCR 작업이 아직 완료되지 않았습니다."

    async def test_create_guide_job_for_other_user_ocr_fails(self):
        owner_email = "guide_owner@example.com"
        other_email = "guide_other@example.com"
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            owner_token = await self._signup_and_login(client, email=owner_email, phone_number="01083008302")
            other_token = await self._signup_and_login(client, email=other_email, phone_number="01083008303")

            owner_ocr_job_id = await self._create_ocr_job(client, access_token=owner_token)
            await self._mark_ocr_succeeded(ocr_job_id=owner_ocr_job_id)

            other_headers = {"Authorization": f"Bearer {other_token}"}
            response = await client.post(
                "/api/v1/guides/jobs",
                headers=other_headers,
                json={"ocr_job_id": owner_ocr_job_id},
            )

        assert response.status_code == status.HTTP_404_NOT_FOUND
        assert response.json()["detail"] == "OCR 작업을 찾을 수 없습니다."

    async def test_get_guide_result_not_ready(self):
        email = "guide_result_not_ready@example.com"
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            access_token = await self._signup_and_login(client, email=email, phone_number="01083008304")
            headers = {"Authorization": f"Bearer {access_token}"}

            ocr_job_id = await self._create_ocr_job(client, access_token=access_token)
            await self._mark_ocr_succeeded(ocr_job_id=ocr_job_id)

            create_response = await client.post("/api/v1/guides/jobs", headers=headers, json={"ocr_job_id": ocr_job_id})
            guide_job_id = create_response.json()["job_id"]

            response = await client.get(f"/api/v1/guides/jobs/{guide_job_id}/result", headers=headers)

        assert response.status_code == status.HTTP_409_CONFLICT
        assert response.json()["detail"] == "가이드 작업이 아직 완료되지 않았습니다."

    async def test_get_guide_result_success(self):
        email = "guide_result_success@example.com"
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            access_token = await self._signup_and_login(client, email=email, phone_number="01083008305")
            headers = {"Authorization": f"Bearer {access_token}"}

            ocr_job_id = await self._create_ocr_job(client, access_token=access_token)
            await self._mark_ocr_succeeded(ocr_job_id=ocr_job_id)
            create_response = await client.post("/api/v1/guides/jobs", headers=headers, json={"ocr_job_id": ocr_job_id})
            guide_job_id = create_response.json()["job_id"]

            guide_job = await GuideJob.get(id=guide_job_id)
            guide_job.status = GuideJobStatus.SUCCEEDED
            await guide_job.save(update_fields=["status"])
            await GuideResult.create(
                job=guide_job,
                medication_guidance="복약 가이드",
                lifestyle_guidance="생활습관 가이드",
                risk_level=GuideRiskLevel.LOW,
                safety_notice="본 가이드는 의료진 진료를 대체할 수 없습니다.",
                structured_data={"source": "test"},
            )

            response = await client.get(f"/api/v1/guides/jobs/{guide_job_id}/result", headers=headers)

        assert response.status_code == status.HTTP_200_OK
        body = response.json()
        assert body["job_id"] == guide_job_id
        assert body["medication_guidance"] == "복약 가이드"
        assert body["lifestyle_guidance"] == "생활습관 가이드"
        assert body["risk_level"] == "LOW"
        assert body["safety_notice"] == "본 가이드는 의료진 진료를 대체할 수 없습니다."
