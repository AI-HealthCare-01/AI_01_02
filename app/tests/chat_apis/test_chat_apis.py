from httpx import ASGITransport, AsyncClient
from starlette import status
from tortoise.contrib.test import TestCase

from app.main import app


class TestChatApis(TestCase):
    async def _login(self, client, email, phone):
        await client.post(
            "/api/v1/auth/signup",
            json={
                "email": email,
                "password": "Password123!",
                "name": "t",
                "gender": "MALE",
                "birth_date": "1990-01-01",
                "phone_number": phone,
            },
        )
        r = await client.post("/api/v1/auth/login", json={"email": email, "password": "Password123!"})
        return r.json()["access_token"]

    async def test_prompt_options(self):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
            t = await self._login(c, "cp@e.com", "01095001000")
            r = await c.get("/api/v1/chat/prompt-options", headers={"Authorization": f"Bearer {t}"})
        assert r.status_code == status.HTTP_200_OK
        assert len(r.json()["items"]) > 0

    async def test_create_session(self):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
            t = await self._login(c, "cs@e.com", "01095001001")
            r = await c.post("/api/v1/chat/sessions", json={"title": "t"}, headers={"Authorization": f"Bearer {t}"})
        assert r.status_code == status.HTTP_201_CREATED
        assert r.json()["status"] == "ACTIVE"

    async def test_send_and_list(self):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
            t = await self._login(c, "cm@e.com", "01095001002")
            h = {"Authorization": f"Bearer {t}"}
            sid = (await c.post("/api/v1/chat/sessions", json={}, headers=h)).json()["id"]
            sr = await c.post(f"/api/v1/chat/sessions/{sid}/messages", json={"message": "hello"}, headers=h)
            assert sr.status_code == status.HTTP_200_OK
            assert sr.json()["role"] == "ASSISTANT"
            lr = await c.get(f"/api/v1/chat/sessions/{sid}/messages", headers=h)
            assert lr.json()["meta"]["total"] == 2

    async def test_guardrail(self):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
            t = await self._login(c, "cg@e.com", "01095001003")
            h = {"Authorization": f"Bearer {t}"}
            sid = (await c.post("/api/v1/chat/sessions", json={}, headers=h)).json()["id"]
            r = await c.post(
                f"/api/v1/chat/sessions/{sid}/messages",
                json={"message": "\uc790\uc0b4\ud558\uace0 \uc2f6\uc5b4\uc694"},
                headers=h,
            )
        assert r.status_code == status.HTTP_200_OK
        assert "1577-0199" in r.json()["content"] or "1393" in r.json()["content"]

    async def test_delete_and_404(self):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
            t = await self._login(c, "cd@e.com", "01095001004")
            h = {"Authorization": f"Bearer {t}"}
            sid = (await c.post("/api/v1/chat/sessions", json={}, headers=h)).json()["id"]
            dr = await c.delete(f"/api/v1/chat/sessions/{sid}", headers=h)
            assert dr.status_code == status.HTTP_204_NO_CONTENT
            r = await c.get(f"/api/v1/chat/sessions/{sid}/messages", headers=h)
            assert r.status_code == status.HTTP_404_NOT_FOUND

    async def test_other_user_404(self):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
            ta = await self._login(c, "coa@e.com", "01095001005")
            tb = await self._login(c, "cob@e.com", "01095001006")
            sid = (await c.post("/api/v1/chat/sessions", json={}, headers={"Authorization": f"Bearer {ta}"})).json()[
                "id"
            ]
            r = await c.get(
                f"/api/v1/chat/sessions/{sid}/messages",
                headers={"Authorization": f"Bearer {tb}"},
            )
            assert r.status_code == status.HTTP_404_NOT_FOUND
