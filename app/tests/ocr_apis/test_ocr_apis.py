from pathlib import Path
from tempfile import TemporaryDirectory
from unittest.mock import AsyncMock, patch

from httpx import ASGITransport, AsyncClient
from starlette import status
from tortoise.contrib.test import TestCase

from app.core import config
from app.main import app
from app.models.ocr import Document, OcrFailureCode, OcrJob, OcrJobStatus, OcrResult


class TestOcrApis(TestCase):
    def setUp(self) -> None:
        self._tmp_media_dir = TemporaryDirectory()
        self._media_dir_patcher = patch.object(config, "MEDIA_DIR", self._tmp_media_dir.name)
        self._media_dir_patcher.start()
        self._queue_patcher = patch(
            "app.services.ocr.OcrQueuePublisher.enqueue_job",
            new=AsyncMock(return_value=None),
        )
        self._queue_patcher.start()

    def tearDown(self) -> None:
        self._queue_patcher.stop()
        self._media_dir_patcher.stop()
        self._tmp_media_dir.cleanup()

    async def _signup_and_login(self, client: AsyncClient, *, email: str, phone_number: str) -> str:
        signup_response = await client.post(
            "/api/v1/auth/signup",
            json={
                "email": email,
                "password": "Password123!",
                "name": "OCR API 테스트",
                "gender": "MALE",
                "birth_date": "1990-01-01",
                "phone_number": phone_number,
            },
        )
        assert signup_response.status_code == status.HTTP_201_CREATED
        login_response = await client.post("/api/v1/auth/login", json={"email": email, "password": "Password123!"})
        assert login_response.status_code == status.HTTP_200_OK
        return login_response.json()["access_token"]

    async def _upload_document(self, client: AsyncClient, *, access_token: str, file_name: str = "test.png") -> dict:
        headers = {"Authorization": f"Bearer {access_token}"}
        response = await client.post(
            "/api/v1/ocr/documents/upload",
            headers=headers,
            data={"document_type": "PRESCRIPTION"},
            files={"file": (file_name, b"fake-image-bytes", "image/png")},
        )
        assert response.status_code == status.HTTP_201_CREATED
        return response.json()

    async def test_upload_document_success(self):
        email = "ocr_upload_success@example.com"
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            access_token = await self._signup_and_login(client, email=email, phone_number="01012001200")
            body = await self._upload_document(client, access_token=access_token)

        assert body["document_type"] == "PRESCRIPTION"
        assert body["file_name"] == "test.png"
        assert body["file_size"] == len(b"fake-image-bytes")

        stored_path = Path(config.MEDIA_DIR) / body["file_path"]
        assert stored_path.exists() is True

    async def test_upload_document_invalid_extension(self):
        email = "ocr_upload_extension@example.com"
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            access_token = await self._signup_and_login(client, email=email, phone_number="01012001201")
            headers = {"Authorization": f"Bearer {access_token}"}
            response = await client.post(
                "/api/v1/ocr/documents/upload",
                headers=headers,
                data={"document_type": "PRESCRIPTION"},
                files={"file": ("test.txt", b"not-allowed", "text/plain")},
            )

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "허용되지 않는 파일 형식" in response.json()["detail"]

    async def test_upload_document_too_large(self):
        email = "ocr_upload_large@example.com"
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            access_token = await self._signup_and_login(client, email=email, phone_number="01012001202")
            headers = {"Authorization": f"Bearer {access_token}"}

            with patch.object(config, "OCR_MAX_FILE_SIZE_BYTES", 10):
                response = await client.post(
                    "/api/v1/ocr/documents/upload",
                    headers=headers,
                    data={"document_type": "PRESCRIPTION"},
                    files={"file": ("big.png", b"01234567890", "image/png")},
                )

        assert response.status_code == status.HTTP_413_CONTENT_TOO_LARGE

    async def test_create_ocr_job_and_get_status_success(self):
        email = "ocr_job_success@example.com"
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            access_token = await self._signup_and_login(client, email=email, phone_number="01012001203")
            document = await self._upload_document(client, access_token=access_token)
            headers = {"Authorization": f"Bearer {access_token}"}

            create_response = await client.post(
                "/api/v1/ocr/jobs",
                headers=headers,
                json={"document_id": document["id"]},
            )
            assert create_response.status_code == status.HTTP_202_ACCEPTED
            create_body = create_response.json()
            assert create_body["status"] == "QUEUED"
            assert create_body["retry_count"] == 0
            assert create_body["max_retries"] == config.OCR_JOB_MAX_RETRIES

            status_response = await client.get(f"/api/v1/ocr/jobs/{create_body['job_id']}", headers=headers)
            assert status_response.status_code == status.HTTP_200_OK
            status_body = status_response.json()
            assert status_body["status"] == "QUEUED"
            assert status_body["retry_count"] == 0
            assert status_body["max_retries"] == config.OCR_JOB_MAX_RETRIES
            assert status_body["failure_code"] is None
            assert status_body["document_id"] == document["id"]

    async def test_create_ocr_job_for_other_user_document_fails(self):
        owner_email = "ocr_owner@example.com"
        other_email = "ocr_other@example.com"
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            owner_access_token = await self._signup_and_login(client, email=owner_email, phone_number="01012001204")
            other_access_token = await self._signup_and_login(client, email=other_email, phone_number="01012001205")

            owner_document = await self._upload_document(client, access_token=owner_access_token)
            other_headers = {"Authorization": f"Bearer {other_access_token}"}
            response = await client.post(
                "/api/v1/ocr/jobs",
                headers=other_headers,
                json={"document_id": owner_document["id"]},
            )

        assert response.status_code == status.HTTP_404_NOT_FOUND
        assert response.json()["detail"] == "문서를 찾을 수 없습니다."

    async def test_create_ocr_job_queue_publish_failure_marks_job_failed(self):
        email = "ocr_queue_failure@example.com"
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            access_token = await self._signup_and_login(client, email=email, phone_number="01012001211")
            document = await self._upload_document(client, access_token=access_token)
            headers = {"Authorization": f"Bearer {access_token}"}

            with patch(
                "app.services.ocr.OcrQueuePublisher.enqueue_job",
                new=AsyncMock(side_effect=RuntimeError("redis unavailable")),
            ):
                response = await client.post(
                    "/api/v1/ocr/jobs",
                    headers=headers,
                    json={"document_id": document["id"]},
                )

        assert response.status_code == status.HTTP_503_SERVICE_UNAVAILABLE
        assert response.json()["detail"] == "OCR 작업 큐 등록에 실패했습니다. 잠시 후 다시 시도해주세요."

        failed_job = await OcrJob.filter(document_id=int(document["id"])).order_by("-id").first()
        assert failed_job is not None
        assert failed_job.status == OcrJobStatus.FAILED
        assert failed_job.failure_code == OcrFailureCode.PROCESSING_ERROR
        assert failed_job.completed_at is not None
        assert failed_job.error_message == "[PROCESSING_ERROR] OCR queue publish failed."

        document_record = await Document.get(id=int(document["id"]))
        stored_path = Path(config.MEDIA_DIR) / document_record.file_path
        assert stored_path.exists() is False

    async def test_get_ocr_job_of_other_user_fails(self):
        owner_email = "ocr_job_owner@example.com"
        other_email = "ocr_job_other@example.com"
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            owner_access_token = await self._signup_and_login(client, email=owner_email, phone_number="01012001206")
            other_access_token = await self._signup_and_login(client, email=other_email, phone_number="01012001207")

            owner_document = await self._upload_document(client, access_token=owner_access_token)
            owner_headers = {"Authorization": f"Bearer {owner_access_token}"}
            job_response = await client.post(
                "/api/v1/ocr/jobs",
                headers=owner_headers,
                json={"document_id": owner_document["id"]},
            )
            owner_job_id = job_response.json()["job_id"]

            other_headers = {"Authorization": f"Bearer {other_access_token}"}
            response = await client.get(f"/api/v1/ocr/jobs/{owner_job_id}", headers=other_headers)

        assert response.status_code == status.HTTP_404_NOT_FOUND
        assert response.json()["detail"] == "OCR 작업을 찾을 수 없습니다."

    async def test_ocr_resources_created_in_db(self):
        email = "ocr_db_resource@example.com"
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            access_token = await self._signup_and_login(client, email=email, phone_number="01012001208")
            document = await self._upload_document(client, access_token=access_token)
            headers = {"Authorization": f"Bearer {access_token}"}
            create_response = await client.post(
                "/api/v1/ocr/jobs",
                headers=headers,
                json={"document_id": document["id"]},
            )

        job_id = create_response.json()["job_id"]
        db_document = await Document.get(id=int(document["id"]))
        db_job = await OcrJob.get(id=int(job_id))
        assert db_document.file_name == "test.png"
        assert db_job.document_id == db_document.id

    async def test_get_ocr_result_not_ready(self):
        email = "ocr_result_not_ready@example.com"
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            access_token = await self._signup_and_login(client, email=email, phone_number="01012001209")
            document = await self._upload_document(client, access_token=access_token)
            headers = {"Authorization": f"Bearer {access_token}"}
            create_response = await client.post(
                "/api/v1/ocr/jobs",
                headers=headers,
                json={"document_id": document["id"]},
            )
            job_id = create_response.json()["job_id"]
            response = await client.get(f"/api/v1/ocr/jobs/{job_id}/result", headers=headers)

        assert response.status_code == status.HTTP_409_CONFLICT
        assert response.json()["detail"] == "OCR 작업이 아직 완료되지 않았습니다."

    async def test_get_ocr_result_success(self):
        email = "ocr_result_success@example.com"
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            access_token = await self._signup_and_login(client, email=email, phone_number="01012001210")
            document = await self._upload_document(client, access_token=access_token)
            headers = {"Authorization": f"Bearer {access_token}"}
            create_response = await client.post(
                "/api/v1/ocr/jobs",
                headers=headers,
                json={"document_id": document["id"]},
            )
            job_id = create_response.json()["job_id"]

            job = await OcrJob.get(id=int(job_id))
            job.status = OcrJobStatus.SUCCEEDED
            await job.save(update_fields=["status"])
            await OcrResult.create(
                job=job,
                extracted_text="테스트 OCR 결과",
                structured_data={"summary": "ok"},
            )

            response = await client.get(f"/api/v1/ocr/jobs/{job_id}/result", headers=headers)

        assert response.status_code == status.HTTP_200_OK
        body = response.json()
        assert body["job_id"] == job_id
        assert body["extracted_text"] == "테스트 OCR 결과"
        assert body["structured_data"]["summary"] == "ok"
