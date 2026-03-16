from unittest.mock import AsyncMock, patch

from httpx import ASGITransport, AsyncClient
from starlette import status
from tortoise.contrib.test import TestCase

from app.main import app
from app.models.health_profiles import UserHealthProfile
from app.models.reminders import MedicationReminder
from app.models.users import User
from app.services.rag import RagResult


class TestChatApis(TestCase):
    async def _login(self, client, email, phone):
        await client.post(
            "/api/v1/auth/signup",
            json={
                "email": email,
                "password": "Password123!",
                "name": "테스터",
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

    @patch("app.services.chat.chat_completion", new_callable=AsyncMock, return_value="mock reply")
    @patch("app.services.chat._classify_intent", new_callable=AsyncMock, return_value="chitchat")
    async def test_send_and_list(self, _mock_intent, _mock_chat):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
            t = await self._login(c, "cm@e.com", "01095001002")
            h = {"Authorization": f"Bearer {t}"}
            sid = (await c.post("/api/v1/chat/sessions", json={}, headers=h)).json()["id"]
            sr = await c.post(f"/api/v1/chat/sessions/{sid}/messages", json={"message": "hello"}, headers=h)
            assert sr.status_code == status.HTTP_201_CREATED
            assert sr.json()["role"] == "ASSISTANT"
            lr = await c.get(f"/api/v1/chat/sessions/{sid}/messages", headers=h)
            assert lr.json()["meta"]["total"] == 2

    @patch("app.services.chat.hybrid_search", new_callable=AsyncMock, return_value=([], False))
    @patch("app.services.chat.chat_completion", new_callable=AsyncMock, return_value="mock reply")
    @patch("app.services.chat._classify_intent", new_callable=AsyncMock, return_value="medical")
    async def test_medication_context_injected_for_medication_question(self, _mock_intent, mock_chat, _mock_search):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
            email = "cm_medctx@e.com"
            t = await self._login(c, email, "01095001009")
            h = {"Authorization": f"Bearer {t}"}
            user = await User.get(email=email)
            await MedicationReminder.create(
                user_id=user.id,
                medication_name="콘서타",
                dose_text="18mg",
                schedule_times=["09:00"],
                enabled=True,
            )
            sid = (await c.post("/api/v1/chat/sessions", json={}, headers=h)).json()["id"]
            r = await c.post(
                f"/api/v1/chat/sessions/{sid}/messages",
                json={"message": "내가 먹는 약의 기전을 알려줘"},
                headers=h,
            )

        assert r.status_code == status.HTTP_201_CREATED
        system_content = mock_chat.await_args.kwargs["messages"][0]["content"]
        assert "[사용자 복약 정보]" in system_content
        assert "콘서타" in system_content
        assert "용량 18mg" in system_content

    @patch("app.services.chat.hybrid_search", new_callable=AsyncMock, return_value=([], False))
    @patch("app.services.chat.chat_completion", new_callable=AsyncMock, return_value="mock reply")
    @patch("app.services.chat._classify_intent", new_callable=AsyncMock, return_value="medical")
    async def test_medication_context_not_injected_for_non_medication_medical_question(
        self, _mock_intent, mock_chat, _mock_search
    ):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
            email = "cm_lifestyle@e.com"
            t = await self._login(c, email, "01095001010")
            h = {"Authorization": f"Bearer {t}"}
            user = await User.get(email=email)
            await MedicationReminder.create(
                user_id=user.id,
                medication_name="콘서타",
                dose_text="18mg",
                schedule_times=["09:00"],
                enabled=True,
            )
            sid = (await c.post("/api/v1/chat/sessions", json={}, headers=h)).json()["id"]
            r = await c.post(
                f"/api/v1/chat/sessions/{sid}/messages",
                json={"message": "ADHD에 운동이 도움이 되나요?"},
                headers=h,
            )

        assert r.status_code == status.HTTP_201_CREATED
        system_content = mock_chat.await_args.kwargs["messages"][0]["content"]
        assert "[사용자 복약 정보]" not in system_content

    @patch("app.services.chat.hybrid_search", new_callable=AsyncMock, return_value=([], False))
    @patch("app.services.chat.chat_completion", new_callable=AsyncMock, return_value="mock reply")
    @patch("app.services.chat._classify_intent", new_callable=AsyncMock, return_value="medical")
    async def test_medication_context_injected_for_caffeine_question(self, _mock_intent, mock_chat, _mock_search):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
            email = "cm_caffeine@e.com"
            t = await self._login(c, email, "01095001011")
            h = {"Authorization": f"Bearer {t}"}
            user = await User.get(email=email)
            await MedicationReminder.create(
                user_id=user.id,
                medication_name="메틸페니데이트",
                dose_text="27mg",
                schedule_times=["08:30"],
                enabled=True,
            )
            sid = (await c.post("/api/v1/chat/sessions", json={}, headers=h)).json()["id"]
            r = await c.post(
                f"/api/v1/chat/sessions/{sid}/messages",
                json={"message": "커피 마셔도 돼?"},
                headers=h,
            )

        assert r.status_code == status.HTTP_201_CREATED
        system_content = mock_chat.await_args.kwargs["messages"][0]["content"]
        assert "[사용자 복약 정보]" in system_content
        assert "메틸페니데이트" in system_content

    @patch("app.services.chat.hybrid_search", new_callable=AsyncMock, return_value=([], False))
    @patch("app.services.chat.chat_completion", new_callable=AsyncMock, return_value="생활습관을 조정해보세요.")
    @patch("app.services.chat._classify_intent", new_callable=AsyncMock, return_value="medical")
    async def test_lifestyle_context_injected_from_user_health_profile(self, _mock_intent, mock_chat, _mock_search):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
            email = "cm_user_health_profile@e.com"
            t = await self._login(c, email, "01095001015")
            h = {"Authorization": f"Bearer {t}"}
            user = await User.get(email=email)
            await UserHealthProfile.create(
                user=user,
                height_cm=175.0,
                weight_kg=70.0,
                drug_allergies=[],
                exercise_frequency_per_week=4,
                pc_hours_per_day=5,
                smartphone_hours_per_day=6,
                caffeine_cups_per_day=3,
                smoking=0,
                alcohol_frequency_per_week=1,
                bed_time="23:30",
                wake_time="06:30",
                sleep_latency_minutes=20,
                night_awakenings_per_week=1,
                daytime_sleepiness=4,
                appetite_level=5,
                meal_regular=True,
                bmi=22.86,
                sleep_time_hours=7.0,
                caffeine_mg=300,
                digital_time_hours=11,
            )
            sid = (await c.post("/api/v1/chat/sessions", json={}, headers=h)).json()["id"]
            r = await c.post(
                f"/api/v1/chat/sessions/{sid}/messages",
                json={"message": "내 생활습관을 고려해서 ADHD 관리를 어떻게 하면 좋을까?"},
                headers=h,
            )

        assert r.status_code == status.HTTP_201_CREATED
        system_content = mock_chat.await_args.kwargs["messages"][0]["content"]
        assert "[사용자 생활습관 정보]" in system_content
        assert "예상 수면 시간 7시간" in system_content
        assert "카페인 섭취 하루 3잔" in system_content
        assert "주간 운동 빈도 4회" in system_content
        assert "스마트폰 사용 하루 6시간" in system_content

    @patch("app.services.chat.hybrid_search", new_callable=AsyncMock, return_value=([], False))
    @patch("app.services.chat.chat_completion", new_callable=AsyncMock, return_value="생활습관을 조정해보세요.")
    @patch("app.services.chat._classify_intent", new_callable=AsyncMock, return_value="medical")
    async def test_lifestyle_context_injected_for_personalized_guidance(self, _mock_intent, mock_chat, _mock_search):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
            email = "cm_lifestyle_ctx@e.com"
            t = await self._login(c, email, "01095001012")
            h = {"Authorization": f"Bearer {t}"}
            user = await User.get(email=email)
            await UserHealthProfile.create(
                user=user,
                height_cm=170.0,
                weight_kg=65.0,
                drug_allergies=[],
                exercise_frequency_per_week=3,
                pc_hours_per_day=4,
                smartphone_hours_per_day=5,
                caffeine_cups_per_day=3,
                smoking=0,
                alcohol_frequency_per_week=0,
                bed_time="01:00",
                wake_time="06:30",
                sleep_latency_minutes=15,
                night_awakenings_per_week=0,
                daytime_sleepiness=3,
                appetite_level=5,
                meal_regular=True,
                bmi=22.49,
                sleep_time_hours=5.5,
                caffeine_mg=300,
                digital_time_hours=9,
            )
            sid = (await c.post("/api/v1/chat/sessions", json={}, headers=h)).json()["id"]
            r = await c.post(
                f"/api/v1/chat/sessions/{sid}/messages",
                json={"message": "ADHD를 더 잘 관리하려면 어떻게 해야 해?"},
                headers=h,
            )

        assert r.status_code == status.HTTP_201_CREATED
        system_content = mock_chat.await_args.kwargs["messages"][0]["content"]
        assert "[사용자 생활습관 정보]" in system_content
        assert "예상 수면 시간 5.5시간" in system_content
        assert "카페인 섭취 하루 3잔" in system_content
        assert "스마트폰 사용 하루 5시간" in system_content

    @patch("app.services.chat.hybrid_search", new_callable=AsyncMock, return_value=([], False))
    @patch(
        "app.services.chat.chat_completion",
        new_callable=AsyncMock,
        return_value="메틸페니데이트는 도파민과 노르에피네프린에 영향을 줍니다.",
    )
    @patch("app.services.chat._classify_intent", new_callable=AsyncMock, return_value="medical")
    async def test_follow_up_questions_appended(self, _mock_intent, _mock_chat, _mock_search):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
            t = await self._login(c, "cm_followup@e.com", "01095001013")
            h = {"Authorization": f"Bearer {t}"}
            sid = (await c.post("/api/v1/chat/sessions", json={}, headers=h)).json()["id"]
            r = await c.post(
                f"/api/v1/chat/sessions/{sid}/messages",
                json={"message": "내가 먹는 약의 기전을 알려줘"},
                headers=h,
            )

        assert r.status_code == status.HTTP_201_CREATED
        body = r.json()
        assert "더 도와드릴 수 있는 내용" in body["content"]
        assert body["content"].count("• ") >= 3

    @patch("app.services.chat.chat_completion", new_callable=AsyncMock)
    @patch("app.services.chat._classify_intent", new_callable=AsyncMock, return_value="medical")
    async def test_adhd_risk_behavior_blocks_normal_answer(self, _mock_intent, mock_chat):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
            email = "cm_risk@e.com"
            t = await self._login(c, email, "01095001014")
            h = {"Authorization": f"Bearer {t}"}
            user = await User.get(email=email)
            await MedicationReminder.create(
                user_id=user.id,
                medication_name="콘서타",
                dose_text="18mg",
                schedule_times=["09:00"],
                enabled=True,
            )
            sid = (await c.post("/api/v1/chat/sessions", json={}, headers=h)).json()["id"]
            r = await c.post(
                f"/api/v1/chat/sessions/{sid}/messages",
                json={"message": "콘서타 두 알 먹어도 돼?"},
                headers=h,
            )

        assert r.status_code == status.HTTP_201_CREATED
        body = r.json()
        assert "복약 안전 안내" in body["content"]
        assert "추가 복용은 하지 마세요." in body["content"]
        mock_chat.assert_not_awaited()

    @patch("app.services.chat.chat_completion", new_callable=AsyncMock, return_value="mock reply")
    @patch(
        "app.services.chat._select_used_references",
        new_callable=AsyncMock,
        return_value=[
            {
                "document_id": "adhd-med-001",
                "title": "메틸페니데이트(콘서타/리탈린) 복약 안내",
                "source": "대한소아청소년정신의학회",
                "url": "https://www.kacap.or.kr",
                "score": 0.91,
            }
        ],
    )
    @patch(
        "app.services.chat.hybrid_search",
        new_callable=AsyncMock,
        return_value=(
            [
                RagResult(
                    "adhd-med-001",
                    "메틸페니데이트(콘서타/리탈린) 복약 안내",
                    "대한소아청소년정신의학회",
                    "https://www.kacap.or.kr",
                    "dummy content",
                    0.91,
                ),
                RagResult(
                    "adhd-exercise-001",
                    "ADHD 환자의 운동 효과와 권장 사항",
                    "대한스포츠의학회",
                    "https://www.sportsmed.or.kr",
                    "other content",
                    0.72,
                ),
            ],
            False,
        ),
    )
    @patch("app.services.chat._classify_intent", new_callable=AsyncMock, return_value="medical")
    async def test_send_message_includes_references(self, _mock_intent, _mock_search, _mock_select_refs, _mock_chat):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
            t = await self._login(c, "cm_ref@e.com", "01095001007")
            h = {"Authorization": f"Bearer {t}"}
            sid = (await c.post("/api/v1/chat/sessions", json={}, headers=h)).json()["id"]
            r = await c.post(
                f"/api/v1/chat/sessions/{sid}/messages",
                json={"message": "콘서타는 언제 먹나요?"},
                headers=h,
            )

        assert r.status_code == status.HTTP_201_CREATED
        body = r.json()
        assert len(body["references"]) == 1
        assert body["references"][0]["document_id"] == "adhd-med-001"
        assert body["references"][0]["source"] == "대한소아청소년정신의학회"

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
        assert r.status_code == status.HTTP_201_CREATED
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

    async def _fake_stream_chat_completion(self, *, model, messages, temperature=0.7):
        yield "mock "
        yield "reply"

    @patch(
        "app.services.chat._select_used_references",
        new_callable=AsyncMock,
        return_value=[
            {
                "document_id": "adhd-med-001",
                "title": "메틸페니데이트(콘서타/리탈린) 복약 안내",
                "source": "대한소아청소년정신의학회",
                "url": "https://www.kacap.or.kr",
                "score": 0.91,
            }
        ],
    )
    @patch("app.services.chat.hybrid_search")
    @patch("app.services.chat._classify_intent", new_callable=AsyncMock, return_value="medical")
    async def test_stream_message_emits_reference_event(self, _mock_intent, mock_search, _mock_select_refs):
        mock_search.return_value = (
            [
                RagResult(
                    "adhd-med-001",
                    "메틸페니데이트(콘서타/리탈린) 복약 안내",
                    "대한소아청소년정신의학회",
                    "https://www.kacap.or.kr",
                    "dummy content",
                    0.91,
                )
            ],
            False,
        )

        with patch("app.services.chat.stream_chat_completion", new=self._fake_stream_chat_completion):
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
                t = await self._login(c, "cm_stream@e.com", "01095001008")
                h = {"Authorization": f"Bearer {t}"}
                sid = (await c.post("/api/v1/chat/sessions", json={}, headers=h)).json()["id"]

                async with c.stream(
                    "POST",
                    f"/api/v1/chat/sessions/{sid}/stream",
                    json={"message": "콘서타는 언제 먹나요?"},
                    headers=h,
                ) as r:
                    body = ""
                    async for chunk in r.aiter_text():
                        body += chunk

        assert r.status_code == status.HTTP_200_OK
        assert "event: reference" in body
        assert "대한소아청소년정신의학회" in body
