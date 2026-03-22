from datetime import datetime, timedelta

from httpx import ASGITransport, AsyncClient
from starlette import status
from tortoise.contrib.test import TestCase

from app.core import config
from app.main import app
from app.models.guides import GuideJob, GuideJobStatus
from app.models.health_profiles import UserHealthProfile
from app.models.notifications import Notification, NotificationType
from app.models.ocr import Document, DocumentType, OcrJob, OcrJobStatus
from app.models.psych_drugs import PsychDrug
from app.models.reminders import MedicationReminder, ScheduleItem, ScheduleItemCategory, ScheduleItemStatus
from app.models.users import User
from app.services.notifications import _sync_cache


class TestNotificationApis(TestCase):
    async def asyncSetUp(self) -> None:
        await super().asyncSetUp()
        _sync_cache.clear()

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

    async def _create_health_profile_with_allergy(self, *, user: User, drug_allergies: list[str]) -> UserHealthProfile:
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

    async def _create_prescription_ocr(self, *, user: User, file_name: str, drug_name: str) -> OcrJob:
        document = await Document.create(
            user=user,
            document_type=DocumentType.PRESCRIPTION,
            file_name=file_name,
            temp_storage_key=f"documents/test/{file_name}",
            file_size=100,
            mime_type="image/png",
        )
        return await OcrJob.create(
            user=user,
            document=document,
            status=OcrJobStatus.SUCCEEDED,
            structured_result={"extracted_medications": [{"drug_name": drug_name}]},
        )

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

    async def test_health_alert_is_created_once_per_day_for_same_source(self):
        email = "noti_health_once@example.com"
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            access_token = await self._signup_and_login(client, email=email, phone_number="01040004003")
            user = await User.get(email=email)

            await self._create_health_profile_with_allergy(user=user, drug_allergies=["페니드정"])
            await PsychDrug.create(
                ingredient_name="메틸페니데이트",
                product_name="페니드정",
                side_effects="",
                precautions="",
            )
            await PsychDrug.create(
                ingredient_name="메틸페니데이트",
                product_name="메디키넷리타드캡슐",
                side_effects="",
                precautions="",
            )
            await self._create_prescription_ocr(user=user, file_name="same_source.png", drug_name="메디키넷리타드캡슐")

            headers = {"Authorization": f"Bearer {access_token}"}
            first = await client.get("/api/v1/notifications", headers=headers)
            second = await client.get("/api/v1/notifications", headers=headers)

            assert first.status_code == status.HTTP_200_OK
            assert second.status_code == status.HTTP_200_OK
            alerts = await Notification.filter(user_id=user.id, type=NotificationType.HEALTH_ALERT)
            assert len(alerts) == 1

    async def test_health_alert_is_created_again_when_prescription_changes_same_day(self):
        email = "noti_health_newocr@example.com"
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            access_token = await self._signup_and_login(client, email=email, phone_number="01040004004")
            user = await User.get(email=email)

            await self._create_health_profile_with_allergy(user=user, drug_allergies=["페니드정"])
            await PsychDrug.create(
                ingredient_name="메틸페니데이트",
                product_name="페니드정",
                side_effects="",
                precautions="",
            )
            await PsychDrug.create(
                ingredient_name="메틸페니데이트",
                product_name="메디키넷리타드캡슐",
                side_effects="",
                precautions="",
            )

            await self._create_prescription_ocr(user=user, file_name="ocr1.png", drug_name="메디키넷리타드캡슐")
            headers = {"Authorization": f"Bearer {access_token}"}
            first = await client.get("/api/v1/notifications", headers=headers)
            assert first.status_code == status.HTTP_200_OK

            await self._create_prescription_ocr(user=user, file_name="ocr2.png", drug_name="메디키넷리타드캡슐")
            # TTL 캐시 리셋 — 두 번째 요청에서도 동적 알림 동기화가 실행되도록
            _sync_cache.pop(user.id, None)
            second = await client.get("/api/v1/notifications", headers=headers)
            assert second.status_code == status.HTTP_200_OK

            alerts = await Notification.filter(user_id=user.id, type=NotificationType.HEALTH_ALERT).order_by("id")
            assert len(alerts) == 2
            assert alerts[0].payload["source_ocr_job_id"] != alerts[1].payload["source_ocr_job_id"]

    async def test_health_alert_is_created_again_when_profile_changes_same_day(self):
        email = "noti_health_profile@example.com"
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            access_token = await self._signup_and_login(client, email=email, phone_number="01040004005")
            user = await User.get(email=email)

            profile = await self._create_health_profile_with_allergy(user=user, drug_allergies=["페니드정"])
            await PsychDrug.create(
                ingredient_name="메틸페니데이트",
                product_name="페니드정",
                side_effects="",
                precautions="",
            )
            await PsychDrug.create(
                ingredient_name="메틸페니데이트",
                product_name="메디키넷리타드캡슐",
                side_effects="",
                precautions="",
            )

            await self._create_prescription_ocr(user=user, file_name="profile1.png", drug_name="메디키넷리타드캡슐")
            headers = {"Authorization": f"Bearer {access_token}"}
            first = await client.get("/api/v1/notifications", headers=headers)
            assert first.status_code == status.HTTP_200_OK

            await UserHealthProfile.filter(id=profile.id).update(
                updated_at=datetime.now(config.TIMEZONE) + timedelta(minutes=1)
            )
            _sync_cache.pop(user.id, None)
            second = await client.get("/api/v1/notifications", headers=headers)
            assert second.status_code == status.HTTP_200_OK

            alerts = await Notification.filter(user_id=user.id, type=NotificationType.HEALTH_ALERT).order_by("id")
            assert len(alerts) == 2
            assert alerts[0].payload["profile_updated_at"] != alerts[1].payload["profile_updated_at"]

    async def test_sleep_alert_is_created_again_when_profile_changes_same_day(self):
        email = "noti_sleep_profile@example.com"
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            access_token = await self._signup_and_login(client, email=email, phone_number="01040004006")
            user = await User.get(email=email)

            profile = await self._create_health_profile_with_allergy(user=user, drug_allergies=[])
            await UserHealthProfile.filter(id=profile.id).update(daytime_sleepiness=9)

            headers = {"Authorization": f"Bearer {access_token}"}
            first = await client.get("/api/v1/notifications", headers=headers)
            assert first.status_code == status.HTTP_200_OK

            await UserHealthProfile.filter(id=profile.id).update(
                daytime_sleepiness=9,
                updated_at=datetime.now(config.TIMEZONE) + timedelta(minutes=1),
            )
            _sync_cache.pop(user.id, None)
            second = await client.get("/api/v1/notifications", headers=headers)
            assert second.status_code == status.HTTP_200_OK

            alerts = [
                alert
                for alert in await Notification.filter(user_id=user.id, type=NotificationType.HEALTH_ALERT).order_by(
                    "id"
                )
                if isinstance(alert.payload, dict) and alert.payload.get("alert_key") == "SLEEP::CONDITION_1"
            ]
            assert len(alerts) == 2
            assert alerts[0].payload["profile_updated_at"] != alerts[1].payload["profile_updated_at"]

    async def test_list_notifications_triggers_dynamic_notification_sync(self):
        email = "notification_unread_sync@example.com"
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            access_token = await self._signup_and_login(client, email=email, phone_number="01040004001")
            user = await User.get(email=email)

            document = await Document.create(
                user=user,
                document_type=DocumentType.PRESCRIPTION,
                file_name="weekly_refresh_unread.png",
                temp_storage_key="documents/test/weekly_refresh_unread.png",
                file_size=100,
                mime_type="image/png",
            )
            ocr_job = await OcrJob.create(user=user, document=document, status=OcrJobStatus.SUCCEEDED)
            old_completed_at = datetime.now(config.TIMEZONE) - timedelta(days=8)
            await GuideJob.create(
                user=user,
                ocr_job=ocr_job,
                status=GuideJobStatus.SUCCEEDED,
                completed_at=old_completed_at,
            )

            headers = {"Authorization": f"Bearer {access_token}"}
            response = await client.get("/api/v1/notifications", headers=headers)
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

    async def test_delete_read_notifications_success(self):
        email = "noti_delete_read@example.com"
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            access_token = await self._signup_and_login(client, email=email, phone_number="01083338333")
            user = await User.get(email=email)
            await Notification.create(
                user=user,
                type=NotificationType.SYSTEM,
                title="읽은 알림",
                message="삭제 대상",
                is_read=True,
                read_at=datetime.now(config.TIMEZONE),
            )
            unread_notification = await Notification.create(
                user=user,
                type=NotificationType.HEALTH_ALERT,
                title="안 읽은 알림",
                message="유지 대상",
            )

            headers = {"Authorization": f"Bearer {access_token}"}
            response = await client.delete("/api/v1/notifications/read", headers=headers)

            assert response.status_code == status.HTTP_200_OK
            assert response.json()["updated_count"] == 1

            remaining = await Notification.filter(user_id=user.id).order_by("id")
            assert len(remaining) == 1
            assert remaining[0].id == unread_notification.id

    async def test_list_notifications_creates_weekly_profile_refresh_alert_after_7_days(self):
        email = "noti_weekly_alert@example.com"
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            access_token = await self._signup_and_login(client, email=email, phone_number="01081118111")
            user = await User.get(email=email)

            document = await Document.create(
                user=user,
                document_type=DocumentType.PRESCRIPTION,
                file_name="weekly_refresh.png",
                temp_storage_key="documents/test/weekly_refresh.png",
                file_size=100,
                mime_type="image/png",
            )
            ocr_job = await OcrJob.create(user=user, document=document, status=OcrJobStatus.SUCCEEDED)
            old_completed_at = datetime.now(config.TIMEZONE) - timedelta(days=8)
            await GuideJob.create(
                user=user,
                ocr_job=ocr_job,
                status=GuideJobStatus.SUCCEEDED,
                completed_at=old_completed_at,
            )

            headers = {"Authorization": f"Bearer {access_token}"}
            response = await client.get("/api/v1/notifications", headers=headers)
            assert response.status_code == status.HTTP_200_OK

            body = response.json()
            weekly_alerts = [
                item
                for item in body["items"]
                if item["type"] == "HEALTH_ALERT"
                and item.get("payload", {}).get("event") == "guide_weekly_refresh_required"
            ]
            assert len(weekly_alerts) == 1
            assert "가이드 생성 후 7일이 지났습니다" in weekly_alerts[0]["message"]

    async def test_medication_dday_notification_created_once_per_day(self):
        email = "noti_dday_daily_once@example.com"
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            access_token = await self._signup_and_login(client, email=email, phone_number="01082228222")
            user = await User.get(email=email)
            today = datetime.now(config.TIMEZONE).date()
            await MedicationReminder.create(
                user=user,
                medication_name="메틸페니데이트",
                schedule_times=["09:00"],
                dispensed_date=today - timedelta(days=1),
                total_days=3,
                enabled=True,
            )

            headers = {"Authorization": f"Bearer {access_token}"}
            first = await client.get("/api/v1/notifications", headers=headers)
            second = await client.get("/api/v1/notifications", headers=headers)

            assert first.status_code == status.HTTP_200_OK
            assert second.status_code == status.HTTP_200_OK

            dday_notifications = await Notification.filter(
                user_id=user.id,
                type=NotificationType.MEDICATION_DDAY,
            )
            assert len(dday_notifications) == 1

    async def test_medication_reminder_notification_created_five_minutes_before_schedule(self):
        email = "noti_med_rem@example.com"
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            access_token = await self._signup_and_login(client, email=email, phone_number="01083334444")
            user = await User.get(email=email)
            now = datetime.now(config.TIMEZONE)
            schedule_time = (now + timedelta(minutes=4)).strftime("%H:%M")
            await MedicationReminder.create(
                user=user,
                medication_name="콘서타",
                dose_text="1정",
                schedule_times=[schedule_time],
                enabled=True,
            )

            headers = {"Authorization": f"Bearer {access_token}"}
            response = await client.get("/api/v1/notifications", headers=headers)

            assert response.status_code == status.HTTP_200_OK
            body = response.json()
            medication_notifications = [
                item
                for item in body["items"]
                if item["type"] == "SYSTEM" and item.get("payload", {}).get("event") == "medication_reminder"
            ]
            assert len(medication_notifications) == 1
            assert medication_notifications[0]["title"] == "복약 알림"
            assert medication_notifications[0]["message"] == f"5분 뒤 {schedule_time}에 콘서타 1정 복용 시간입니다."

    async def test_medication_reminder_notification_is_deduplicated_for_same_schedule(self):
        email = "noti_med_dedup@example.com"
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            access_token = await self._signup_and_login(client, email=email, phone_number="01085556666")
            user = await User.get(email=email)
            now = datetime.now(config.TIMEZONE)
            schedule_time = (now + timedelta(minutes=4)).strftime("%H:%M")
            await MedicationReminder.create(
                user=user,
                medication_name="메디키넷",
                schedule_times=[schedule_time],
                enabled=True,
            )

            headers = {"Authorization": f"Bearer {access_token}"}
            first = await client.get("/api/v1/notifications", headers=headers)
            _sync_cache.pop(user.id, None)
            second = await client.get("/api/v1/notifications", headers=headers)

            assert first.status_code == status.HTTP_200_OK
            assert second.status_code == status.HTTP_200_OK

            medication_notifications = await Notification.filter(
                user_id=user.id,
                type=NotificationType.SYSTEM,
            )
            medication_notifications = [
                item
                for item in medication_notifications
                if isinstance(item.payload, dict) and item.payload.get("event") == "medication_reminder"
            ]
            assert len(medication_notifications) == 1

    async def test_medication_reminder_notification_backfills_legacy_numeric_dose_from_ocr(self):
        email = "noti_med_backfill@example.com"
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            access_token = await self._signup_and_login(client, email=email, phone_number="01086667777")
            user = await User.get(email=email)
            now = datetime.now(config.TIMEZONE)
            schedule_time = (now + timedelta(minutes=4)).strftime("%H:%M")

            document = await Document.create(
                user=user,
                document_type=DocumentType.PRESCRIPTION,
                file_name="med_backfill.png",
                temp_storage_key="documents/test/med_backfill.png",
                file_size=100,
                mime_type="image/png",
            )
            await OcrJob.create(
                user=user,
                document=document,
                status=OcrJobStatus.SUCCEEDED,
                confirmed_result={
                    "extracted_medications": [
                        {
                            "drug_name": "메디키넷리타드캡슐",
                            "dose": 10.0,
                            "dosage_per_once": 1,
                        }
                    ]
                },
            )
            reminder = await MedicationReminder.create(
                user=user,
                medication_name="메디키넷리타드캡슐",
                dose_text="10.0",
                schedule_times=[schedule_time],
                enabled=True,
            )

            headers = {"Authorization": f"Bearer {access_token}"}
            response = await client.get("/api/v1/notifications", headers=headers)

            assert response.status_code == status.HTTP_200_OK
            body = response.json()
            medication_notifications = [
                item
                for item in body["items"]
                if item["type"] == "SYSTEM" and item.get("payload", {}).get("event") == "medication_reminder"
            ]
            assert len(medication_notifications) == 1
            assert (
                medication_notifications[0]["message"]
                == f"5분 뒤 {schedule_time}에 메디키넷리타드캡슐 1 캡/정 복용 시간입니다."
            )

            await reminder.refresh_from_db()
            assert reminder.dose_text == "1 캡/정"

    async def test_get_unread_count_triggers_medication_reminder_sync(self):
        email = "noti_med_unread@example.com"
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            access_token = await self._signup_and_login(client, email=email, phone_number="01087778888")
            user = await User.get(email=email)
            now = datetime.now(config.TIMEZONE)
            schedule_time = (now + timedelta(minutes=4)).strftime("%H:%M")
            await MedicationReminder.create(
                user=user,
                medication_name="리탈린",
                schedule_times=[schedule_time],
                enabled=True,
            )

            headers = {"Authorization": f"Bearer {access_token}"}
            response = await client.get("/api/v1/notifications/unread-count", headers=headers)

            assert response.status_code == status.HTTP_200_OK
            assert response.json()["unread_count"] == 1

    async def test_medication_confirmation_notification_created_one_hour_after_pending_schedule(self):
        email = "noti_med_confirm@example.com"
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            access_token = await self._signup_and_login(client, email=email, phone_number="01089990000")
            user = await User.get(email=email)
            reminder = await MedicationReminder.create(
                user=user,
                medication_name="메디키넷리타드캡슐",
                dose_text="1 캡/정",
                schedule_times=["09:00"],
                enabled=True,
            )
            await ScheduleItem.create(
                user=user,
                reminder=reminder,
                category=ScheduleItemCategory.MEDICATION,
                title="복약",
                scheduled_at=datetime.now(config.TIMEZONE) - timedelta(hours=2),
                status=ScheduleItemStatus.PENDING,
            )

            headers = {"Authorization": f"Bearer {access_token}"}
            response = await client.get("/api/v1/notifications", headers=headers)

            assert response.status_code == status.HTTP_200_OK
            body = response.json()
            confirmation_notifications = [
                item
                for item in body["items"]
                if item["type"] == "SYSTEM"
                and item.get("payload", {}).get("event") == "medication_confirmation_required"
            ]
            assert len(confirmation_notifications) == 1
            assert confirmation_notifications[0]["title"] == "복약 확인"
            assert "복용 여부를 선택해주세요" in confirmation_notifications[0]["message"]
