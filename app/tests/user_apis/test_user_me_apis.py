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

    async def test_get_user_me_invalid_token(self):
        headers = {"Authorization": "Bearer invalid-token"}
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            response = await client.get("/api/v1/users/me", headers=headers)
        assert response.status_code == status.HTTP_401_UNAUTHORIZED
        assert response.json()["detail"] == "Provided invalid token."

    async def test_delete_user_me_success(self):
        email = "delete_me@example.com"
        signup_data = {
            "email": email,
            "password": "Password123!",
            "name": "탈퇴테스터",
            "gender": "MALE",
            "birth_date": "1990-01-01",
            "phone_number": "01011110000",
        }
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            await client.post("/api/v1/auth/signup", json=signup_data)
            login_response = await client.post("/api/v1/auth/login", json={"email": email, "password": "Password123!"})
            access_token = login_response.json()["access_token"]
            headers = {"Authorization": f"Bearer {access_token}"}

            delete_response = await client.delete("/api/v1/users/me", headers=headers)
            assert delete_response.status_code == status.HTTP_204_NO_CONTENT

    async def test_delete_user_me_blocks_subsequent_access(self):
        email = "delete_block@example.com"
        signup_data = {
            "email": email,
            "password": "Password123!",
            "name": "차단테스터",
            "gender": "FEMALE",
            "birth_date": "1991-01-01",
            "phone_number": "01022220000",
        }
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            await client.post("/api/v1/auth/signup", json=signup_data)
            login_response = await client.post("/api/v1/auth/login", json={"email": email, "password": "Password123!"})
            access_token = login_response.json()["access_token"]
            headers = {"Authorization": f"Bearer {access_token}"}

            await client.delete("/api/v1/users/me", headers=headers)

            # 탈퇴 후 동일 토큰으로 접근 시 423(비활성 계정) 또는 401(토큰 블랙리스트)
            me_response = await client.get("/api/v1/users/me", headers=headers)
            assert me_response.status_code in (status.HTTP_401_UNAUTHORIZED, status.HTTP_423_LOCKED)
