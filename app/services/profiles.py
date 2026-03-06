from app.dtos.profiles import HealthProfileUpsertRequest
from app.models.health_profiles import UserHealthProfile
from app.models.profiles import HealthProfile
from app.models.users import User


def _compute_bmi(height_cm: float, weight_kg: float) -> float:
    return round(weight_kg / ((height_cm / 100) ** 2), 2)


def _compute_sleep_hours(bed_time: str, wake_time: str) -> float:
    bh, bm = map(int, bed_time.split(":"))
    wh, wm = map(int, wake_time.split(":"))
    duration = ((wh * 60 + wm) - (bh * 60 + bm)) % (24 * 60)
    return round(duration / 60, 2)


class HealthProfileService:
    async def upsert_profile(self, *, user: User, data: HealthProfileUpsertRequest) -> HealthProfile:
        profile, _ = await HealthProfile.update_or_create(
            defaults={
                "basic_info": data.basic_info.model_dump(),
                "lifestyle_input": data.lifestyle_input.model_dump(),
                "sleep_input": data.sleep_input.model_dump(),
                "nutrition_input": data.nutrition_input.model_dump(),
            },
            user_id=user.id,
        )

        # Sync to user_health_profiles (used by guide/analysis services)
        lifestyle = data.lifestyle_input
        sleep = data.sleep_input
        nutrition = data.nutrition_input

        bed_time = sleep.bed_time or "23:00"
        wake_time = sleep.wake_time or "07:00"
        exercise_freq = lifestyle.exercise_hours.low_intensity + lifestyle.exercise_hours.moderate_intensity + lifestyle.exercise_hours.high_intensity

        await UserHealthProfile.update_or_create(
            defaults={
                "height_cm": data.basic_info.height_cm,
                "weight_kg": data.basic_info.weight_kg,
                "drug_allergies": data.basic_info.drug_allergies,
                "exercise_frequency_per_week": exercise_freq,
                "pc_hours_per_day": lifestyle.digital_usage.pc_hours_per_day,
                "smartphone_hours_per_day": lifestyle.digital_usage.smartphone_hours_per_day,
                "caffeine_cups_per_day": lifestyle.substance_usage.caffeine_cups_per_day,
                "smoking": lifestyle.substance_usage.smoking,
                "alcohol_frequency_per_week": lifestyle.substance_usage.alcohol_frequency_per_week,
                "bed_time": bed_time,
                "wake_time": wake_time,
                "sleep_latency_minutes": sleep.sleep_latency_minutes or 0,
                "night_awakenings_per_week": sleep.night_awakenings_per_week or 0,
                "daytime_sleepiness": sleep.daytime_sleepiness_score or 0,
                "appetite_level": nutrition.appetite_score or 5,
                "meal_regular": nutrition.is_meal_regular if nutrition.is_meal_regular is not None else True,
                "bmi": _compute_bmi(data.basic_info.height_cm, data.basic_info.weight_kg),
                "sleep_time_hours": _compute_sleep_hours(bed_time, wake_time),
                "caffeine_mg": lifestyle.substance_usage.caffeine_cups_per_day * 100,
                "digital_time_hours": lifestyle.digital_usage.pc_hours_per_day + lifestyle.digital_usage.smartphone_hours_per_day,
            },
            user_id=user.id,
        )

        return profile

    async def get_profile(self, *, user: User) -> HealthProfile | None:
        return await HealthProfile.get_or_none(user_id=user.id)
