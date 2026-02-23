from httpx import ASGITransport, AsyncClient
from starlette import status
from tortoise.contrib.test import TestCase

from app.main import app


class TestUserMeApis(TestCase):
    async def test_get_user_me_success(self):
        # 사용자 등록 및 로그인
        email = "me@example.com"
        signup_data = {
            "email": email,
            "password": "Password123!",
            "name": "내정보테스터",
            "gender": "FEMALE",
            "birth_date": "1992-02-02",
            "phone_number": "01055556666",
        }
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            await client.post("/api/v1/auth/signup", json=signup_data)

            login_response = await client.post("/api/v1/auth/login", json={"email": email, "password": "Password123!"})
            access_token = login_response.json()["access_token"]

            # 내 정보 조회
            headers = {"Authorization": f"Bearer {access_token}"}
            response = await client.get("/api/v1/users/me", headers=headers)
        assert response.status_code == status.HTTP_200_OK
        assert response.json()["email"] == email
        assert response.json()["name"] == "내정보테스터"

    async def test_update_user_me_success(self):
        # 사용자 등록 및 로그인
        email = "update_me@example.com"
        signup_data = {
            "email": email,
            "password": "Password123!",
            "name": "수정전",
            "gender": "MALE",
            "birth_date": "1990-10-10",
            "phone_number": "01077778888",
        }
        update_data = {"name": "수정후"}
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            await client.post("/api/v1/auth/signup", json=signup_data)

            login_response = await client.post("/api/v1/auth/login", json={"email": email, "password": "Password123!"})
            access_token = login_response.json()["access_token"]

            # 내 정보 수정
            headers = {"Authorization": f"Bearer {access_token}"}
            response = await client.patch("/api/v1/users/me", json=update_data, headers=headers)
        assert response.status_code == status.HTTP_200_OK
        assert response.json()["name"] == "수정후"

    async def test_update_user_me_with_same_email_and_phone_success(self):
        email = "same_profile@example.com"
        original_phone_number = "01033334444"
        signup_data = {
            "email": email,
            "password": "Password123!",
            "name": "동일정보",
            "gender": "MALE",
            "birth_date": "1991-11-11",
            "phone_number": original_phone_number,
        }
        update_data = {
            "email": email,
            "phone_number": "010-3333-4444",
        }

        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            await client.post("/api/v1/auth/signup", json=signup_data)

            login_response = await client.post("/api/v1/auth/login", json={"email": email, "password": "Password123!"})
            access_token = login_response.json()["access_token"]
            headers = {"Authorization": f"Bearer {access_token}"}

            response = await client.patch("/api/v1/users/me", json=update_data, headers=headers)

        assert response.status_code == status.HTTP_200_OK
        assert response.json()["email"] == email
        assert response.json()["phone_number"] == original_phone_number

    async def test_get_user_me_unauthorized(self):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            response = await client.get("/api/v1/users/me")
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    async def test_update_user_me_creates_notification(self):
        email = "update_notification@example.com"
        signup_data = {
            "email": email,
            "password": "Password123!",
            "name": "알림전",
            "gender": "FEMALE",
            "birth_date": "1993-03-03",
            "phone_number": "01090909090",
        }
        update_data = {"name": "알림후"}

        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            await client.post("/api/v1/auth/signup", json=signup_data)
            login_response = await client.post("/api/v1/auth/login", json={"email": email, "password": "Password123!"})
            access_token = login_response.json()["access_token"]
            headers = {"Authorization": f"Bearer {access_token}"}

            update_response = await client.patch("/api/v1/users/me", json=update_data, headers=headers)
            assert update_response.status_code == status.HTTP_200_OK

            notifications_response = await client.get("/api/v1/notifications", headers=headers)
            assert notifications_response.status_code == status.HTTP_200_OK
            items = notifications_response.json()["items"]
            profile_notifications = [
                item
                for item in items
                if item["payload"].get("event") == "profile_updated"
                and "name" in item["payload"].get("changed_fields", [])
            ]
            assert len(profile_notifications) == 1
