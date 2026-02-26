from datetime import datetime

from httpx import ASGITransport, AsyncClient
from starlette import status
from tortoise.contrib.test import TestCase

from app.core import config
from app.main import app
from app.models.notifications import Notification, NotificationType
from app.models.users import User


class TestNotificationApis(TestCase):
    async def _signup_and_login(self, client: AsyncClient, *, email: str, phone_number: str) -> str:
        await client.post(
            "/api/v1/auth/signup",
            json={
                "email": email,
                "password": "Password123!",
                "name": "알림테스터",
                "gender": "MALE",
                "birth_date": "1991-01-01",
                "phone_number": phone_number,
            },
        )
        login_response = await client.post("/api/v1/auth/login", json={"email": email, "password": "Password123!"})
        assert login_response.status_code == status.HTTP_200_OK
        return login_response.json()["access_token"]

    async def test_list_notifications_and_filter(self):
        email = "notification_list@example.com"
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            access_token = await self._signup_and_login(client, email=email, phone_number="01030003000")
            user = await User.get(email=email)

            first = await Notification.create(
                user=user,
                type=NotificationType.SYSTEM,
                title="첫 알림",
                message="첫 알림 메시지",
            )
            await Notification.create(
                user=user,
                type=NotificationType.REPORT_READY,
                title="읽은 알림",
                message="이미 읽음",
                is_read=True,
                read_at=datetime.now(config.TIMEZONE),
            )
            latest = await Notification.create(
                user=user,
                type=NotificationType.HEALTH_ALERT,
                title="최신 알림",
                message="최신 알림 메시지",
            )

            headers = {"Authorization": f"Bearer {access_token}"}
            response = await client.get("/api/v1/notifications", headers=headers)

            assert response.status_code == status.HTTP_200_OK
            body = response.json()
            assert body["unread_count"] == 2
            assert len(body["items"]) == 3
            assert body["items"][0]["id"] == str(latest.id)
            assert any(item["id"] == str(first.id) for item in body["items"])

            unread_response = await client.get("/api/v1/notifications?is_read=false", headers=headers)
            assert unread_response.status_code == status.HTTP_200_OK
            unread_body = unread_response.json()
            assert unread_body["unread_count"] == 2
            assert len(unread_body["items"]) == 2

    async def test_get_unread_count_success(self):
        email = "notification_unread@example.com"
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            access_token = await self._signup_and_login(client, email=email, phone_number="01040004000")
            user = await User.get(email=email)
            await Notification.create(
                user=user,
                type=NotificationType.SYSTEM,
                title="읽지 않은 알림",
                message="읽지 않은 상태",
            )
            await Notification.create(
                user=user,
                type=NotificationType.SYSTEM,
                title="읽은 알림",
                message="읽은 상태",
                is_read=True,
                read_at=datetime.now(config.TIMEZONE),
            )

            headers = {"Authorization": f"Bearer {access_token}"}
            response = await client.get("/api/v1/notifications/unread-count", headers=headers)
            assert response.status_code == status.HTTP_200_OK
            assert response.json()["unread_count"] == 1

    async def test_mark_notification_as_read_success(self):
        email = "notification_read@example.com"
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            access_token = await self._signup_and_login(client, email=email, phone_number="01050005000")
            user = await User.get(email=email)
            notification = await Notification.create(
                user=user,
                type=NotificationType.SYSTEM,
                title="읽을 알림",
                message="아직 읽지 않음",
            )

            headers = {"Authorization": f"Bearer {access_token}"}
            response = await client.patch(f"/api/v1/notifications/{notification.id}/read", headers=headers)

            assert response.status_code == status.HTTP_200_OK
            assert response.json()["is_read"] is True
            assert response.json()["read_at"] is not None

            await notification.refresh_from_db()
            assert notification.is_read is True
            assert notification.read_at is not None

    async def test_mark_notification_as_read_not_found(self):
        owner_email = "notification_owner@example.com"
        other_email = "notification_other@example.com"
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            await self._signup_and_login(client, email=owner_email, phone_number="01060006000")
            other_access_token = await self._signup_and_login(client, email=other_email, phone_number="01070007000")

            owner = await User.get(email=owner_email)
            notification = await Notification.create(
                user=owner,
                type=NotificationType.SYSTEM,
                title="소유자 알림",
                message="다른 유저는 접근 불가",
            )

            headers = {"Authorization": f"Bearer {other_access_token}"}
            response = await client.patch(f"/api/v1/notifications/{notification.id}/read", headers=headers)

            assert response.status_code == status.HTTP_404_NOT_FOUND
            assert response.json()["detail"] == "알림을 찾을 수 없습니다."

    async def test_mark_all_notifications_as_read_success(self):
        email = "notification_read_all@example.com"
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            access_token = await self._signup_and_login(client, email=email, phone_number="01080008000")
            user = await User.get(email=email)
            await Notification.create(
                user=user,
                type=NotificationType.SYSTEM,
                title="읽지 않은 알림1",
                message="읽지 않음",
            )
            await Notification.create(
                user=user,
                type=NotificationType.HEALTH_ALERT,
                title="읽지 않은 알림2",
                message="읽지 않음",
            )
            await Notification.create(
                user=user,
                type=NotificationType.REPORT_READY,
                title="이미 읽은 알림",
                message="이미 읽음",
                is_read=True,
                read_at=datetime.now(config.TIMEZONE),
            )

            headers = {"Authorization": f"Bearer {access_token}"}
            read_all_response = await client.patch("/api/v1/notifications/read-all", headers=headers)
            assert read_all_response.status_code == status.HTTP_200_OK
            assert read_all_response.json()["updated_count"] == 2

            unread_response = await client.get("/api/v1/notifications/unread-count", headers=headers)
            assert unread_response.status_code == status.HTTP_200_OK
            assert unread_response.json()["unread_count"] == 0
