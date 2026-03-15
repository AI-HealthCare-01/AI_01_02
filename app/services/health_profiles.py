from datetime import datetime, timedelta

from app.core import config
from app.dtos.health_profiles import (
    BasicInfoInput,
    ComputedHealthMetrics,
    HealthProfileResponse,
    HealthProfileUpsertRequest,
    LifestyleInput,
    NutritionStatusInput,
    SleepInput,
)
from app.models.health_profiles import UserHealthProfile
from app.models.users import User
from app.repositories.health_profile_repository import HealthProfileRepository
from app.services.guide_automation import GuideAutomationService


def _to_minutes(hhmm: str) -> int:
    hours, minutes = hhmm.split(":")
    return int(hours) * 60 + int(minutes)


def compute_sleep_time_hours(*, bed_time: str, wake_time: str) -> float:
    bed = _to_minutes(bed_time)
    wake = _to_minutes(wake_time)
    duration_minutes = (wake - bed) % (24 * 60)
    return round(duration_minutes / 60, 2)


class HealthProfileService:
    def __init__(self) -> None:
        self.repo = HealthProfileRepository()
        self.guide_automation_service = GuideAutomationService()

    def _compute_metrics(self, request: HealthProfileUpsertRequest) -> ComputedHealthMetrics:
        bmi = round(request.basic_info.weight_kg / ((request.basic_info.height_cm / 100) ** 2), 2)
        sleep_time_hours = compute_sleep_time_hours(
            bed_time=request.sleep_input.bed_time,
            wake_time=request.sleep_input.wake_time,
        )
        caffeine_mg = request.lifestyle.caffeine_cups_per_day * 100
        digital_time_hours = request.lifestyle.pc_hours_per_day + request.lifestyle.smartphone_hours_per_day
        return ComputedHealthMetrics(
            bmi=bmi,
            sleep_time_hours=sleep_time_hours,
            caffeine_mg=caffeine_mg,
            digital_time_hours=digital_time_hours,
        )

    async def upsert_profile(self, *, user: User, request: HealthProfileUpsertRequest) -> UserHealthProfile:
        previous_profile = await self.repo.get_by_user_id(user_id=user.id)
        (
            refresh_required_before_update,
            _,
        ) = await self.guide_automation_service.is_profile_refresh_required_for_guide_generation(user_id=user.id)
        computed = self._compute_metrics(request)
        payload = {
            "height_cm": request.basic_info.height_cm,
            "weight_kg": request.basic_info.weight_kg,
            "drug_allergies": request.basic_info.drug_allergies,
            "exercise_frequency_per_week": request.lifestyle.exercise_frequency_per_week,
            "pc_hours_per_day": request.lifestyle.pc_hours_per_day,
            "smartphone_hours_per_day": request.lifestyle.smartphone_hours_per_day,
            "caffeine_cups_per_day": request.lifestyle.caffeine_cups_per_day,
            "smoking": request.lifestyle.smoking,
            "alcohol_frequency_per_week": request.lifestyle.alcohol_frequency_per_week,
            "bed_time": request.sleep_input.bed_time,
            "wake_time": request.sleep_input.wake_time,
            "sleep_latency_minutes": request.sleep_input.sleep_latency_minutes,
            "night_awakenings_per_week": request.sleep_input.night_awakenings_per_week,
            "daytime_sleepiness": request.sleep_input.daytime_sleepiness,
            "appetite_level": request.nutrition_status.appetite_level,
            "meal_regular": request.nutrition_status.meal_regular,
            "bmi": computed.bmi,
            "sleep_time_hours": computed.sleep_time_hours,
            "caffeine_mg": computed.caffeine_mg,
            "digital_time_hours": computed.digital_time_hours,
            "weekly_refresh_weekday": request.weekly_refresh_weekday,
            "weekly_refresh_time": request.weekly_refresh_time,
            "weekly_adherence_rate": request.weekly_adherence_rate,
        }
        if previous_profile is None:
            payload["onboarding_completed_at"] = datetime.now(config.TIMEZONE)
        profile = await self.repo.upsert_by_user_id(user_id=user.id, payload=payload)

        if refresh_required_before_update or previous_profile is None:
            await self.guide_automation_service.trigger_refresh_with_latest_ocr(
                user_id=user.id,
                reason="profile_updated",
            )
        return profile

    async def get_profile(self, *, user: User) -> UserHealthProfile | None:
        return await self.repo.get_by_user_id(user_id=user.id)

    def is_onboarding_expired(self, profile: UserHealthProfile) -> bool:
        if profile.onboarding_completed_at is None:
            return False
        now = datetime.now(config.TIMEZONE)
        return profile.onboarding_completed_at + timedelta(days=7) <= now

    def serialize(self, profile: UserHealthProfile) -> HealthProfileResponse:
        return HealthProfileResponse(
            user_id=str(profile.user_id),
            basic_info=BasicInfoInput(
                height_cm=profile.height_cm,
                weight_kg=profile.weight_kg,
                drug_allergies=profile.drug_allergies,
            ),
            lifestyle=LifestyleInput(
                exercise_frequency_per_week=profile.exercise_frequency_per_week,
                pc_hours_per_day=profile.pc_hours_per_day,
                smartphone_hours_per_day=profile.smartphone_hours_per_day,
                caffeine_cups_per_day=profile.caffeine_cups_per_day,
                smoking=profile.smoking,
                alcohol_frequency_per_week=profile.alcohol_frequency_per_week,
            ),
            sleep_input=SleepInput(
                bed_time=profile.bed_time,
                wake_time=profile.wake_time,
                sleep_latency_minutes=profile.sleep_latency_minutes,
                night_awakenings_per_week=profile.night_awakenings_per_week,
                daytime_sleepiness=profile.daytime_sleepiness,
            ),
            nutrition_status=NutritionStatusInput(
                appetite_level=profile.appetite_level,
                meal_regular=profile.meal_regular,
            ),
            computed=ComputedHealthMetrics(
                bmi=profile.bmi,
                sleep_time_hours=profile.sleep_time_hours,
                caffeine_mg=profile.caffeine_mg,
                digital_time_hours=profile.digital_time_hours,
            ),
            weekly_refresh_weekday=profile.weekly_refresh_weekday,
            weekly_refresh_time=profile.weekly_refresh_time,
            weekly_adherence_rate=profile.weekly_adherence_rate,
            onboarding_completed_at=profile.onboarding_completed_at,
            updated_at=profile.updated_at,
        )
