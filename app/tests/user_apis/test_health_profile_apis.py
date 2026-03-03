from httpx import ASGITransport, AsyncClient
from starlette import status
from tortoise.contrib.test import TestCase

from app.main import app

_BASIC_INFO = {"height_cm": 175.0, "weight_kg": 70.0, "drug_allergies": ["페니실린"]}
_PROFILE_PAYLOAD = {
    "basic_info": _BASIC_INFO,
    "lifestyle_input": {
        "exercise_hours": {"low_intensity": 2, "moderate_intensity": 1, "high_intensity": 0},
        "digital_usage": {"pc_hours_per_day": 8, "smartphone_hours_per_day": 3},
        "substance_usage": {"caffeine_cups_per_day": 2, "smoking": 0, "alcohol_frequency_per_week": 1},
    },
    "sleep_input": {
        "bed_time": "23:00",
        "wake_time": "07:00",
        "sleep_latency_minutes": 20,
        "night_awakenings_per_week": 1,
        "daytime_sleepiness_score": 3,
    },
    "nutrition_input": {"appetite_score": 7, "is_meal_regular": True},
}


class TestHealthProfileApis(TestCase):
    async def _signup_and_login(self, client: AsyncClient, *, email: str, phone_number: str) -> str:
        await client.post(
            "/api/v1/auth/signup",
            json={
                "email": email,
                "password": "Password123!",
                "name": "프로필테스터",
                "gender": "MALE",
                "birth_date": "1990-01-01",
                "phone_number": phone_number,
            },
        )
        login_response = await client.post("/api/v1/auth/login", json={"email": email, "password": "Password123!"})
        return login_response.json()["access_token"]

    async def test_upsert_health_profile_success(self):
        email = "profile_upsert@example.com"
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            access_token = await self._signup_and_login(client, email=email, phone_number="01091001000")
            headers = {"Authorization": f"Bearer {access_token}"}

            response = await client.put("/api/v1/profiles/health", json=_PROFILE_PAYLOAD, headers=headers)

        assert response.status_code == status.HTTP_200_OK
        body = response.json()
        assert body["basic_info"]["height_cm"] == 175.0
        assert body["basic_info"]["drug_allergies"] == ["페니실린"]
        assert body["sleep_input"]["bed_time"] == "23:00"

    async def test_upsert_health_profile_idempotent(self):
        email = "profile_idempotent@example.com"
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            access_token = await self._signup_and_login(client, email=email, phone_number="01091001001")
            headers = {"Authorization": f"Bearer {access_token}"}

            await client.put("/api/v1/profiles/health", json=_PROFILE_PAYLOAD, headers=headers)

            updated_payload = {**_PROFILE_PAYLOAD, "basic_info": {**_BASIC_INFO, "weight_kg": 72.0}}
            response = await client.put("/api/v1/profiles/health", json=updated_payload, headers=headers)

        assert response.status_code == status.HTTP_200_OK
        assert response.json()["basic_info"]["weight_kg"] == 72.0

    async def test_get_health_profile_success(self):
        email = "profile_get@example.com"
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            access_token = await self._signup_and_login(client, email=email, phone_number="01091001002")
            headers = {"Authorization": f"Bearer {access_token}"}

            await client.put("/api/v1/profiles/health", json=_PROFILE_PAYLOAD, headers=headers)
            response = await client.get("/api/v1/profiles/health", headers=headers)

        assert response.status_code == status.HTTP_200_OK
        assert response.json()["basic_info"]["height_cm"] == 175.0

    async def test_get_health_profile_not_found(self):
        email = "profile_notfound@example.com"
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            access_token = await self._signup_and_login(client, email=email, phone_number="01091001003")
            headers = {"Authorization": f"Bearer {access_token}"}

            response = await client.get("/api/v1/profiles/health", headers=headers)

        assert response.status_code == status.HTTP_404_NOT_FOUND

    async def test_upsert_health_profile_missing_basic_info(self):
        email = "profile_missing@example.com"
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            access_token = await self._signup_and_login(client, email=email, phone_number="01091001004")
            headers = {"Authorization": f"Bearer {access_token}"}

            response = await client.put("/api/v1/profiles/health", json={}, headers=headers)

        assert response.status_code == status.HTTP_422_UNPROCESSABLE_CONTENT
