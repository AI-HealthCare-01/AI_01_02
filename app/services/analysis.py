from app.models.ocr import OcrJobStatus, OcrResult
from app.models.profiles import HealthProfile
from app.models.users import User
from app.services.emergency_guidance import (
    generate_allergy_medication_guidance,
    generate_nutrition_guidance,
    generate_sleep_guidance,
    is_nutrition_guide_condition_1,
    is_sleep_guide_condition_1,
)


def _analyze_lifestyle(lifestyle: dict) -> dict:
    flags = []
    substance = lifestyle.get("substance_usage", {})
    alcohol = substance.get("alcohol_frequency_per_week", 0)
    caffeine = substance.get("caffeine_cups_per_day", 0)
    smoking = substance.get("smoking", 0)
    if alcohol >= 4:
        flags.append(
            {"code": "ALCOHOL_RISK", "level": "HIGH", "message": "주간 음주 횟수가 높습니다. 음주를 줄이세요."}
        )
    if caffeine >= 5:
        flags.append({"code": "CAFFEINE_RISK", "level": "MEDIUM", "message": "카페인 섭취가 과다합니다."})
    if smoking >= 1:
        flags.append(
            {"code": "SMOKING_RISK", "level": "HIGH", "message": "흡연은 ADHD 약물 효과에 영향을 줄 수 있습니다."}
        )
    return {"flags": flags}


def _analyze_sleep(sleep: dict) -> dict:
    flags = []
    sleepiness = sleep.get("daytime_sleepiness_score", 0)
    if sleepiness and sleepiness >= 7:
        flags.append(
            {
                "code": "EXCESSIVE_DAYTIME_SLEEPINESS",
                "level": "HIGH",
                "message": "낮 졸림이 심합니다. 의료진 상담을 권장합니다.",
            }
        )
    return {"flags": flags}


def _analyze_nutrition(nutrition: dict) -> dict:
    flags = []
    appetite = nutrition.get("appetite_score")
    if appetite is not None and appetite <= 3:
        flags.append(
            {"code": "NUTRITION_RISK", "level": "MEDIUM", "message": "식욕이 낮습니다. 규칙적인 식사를 권장합니다."}
        )
    return {"flags": flags}


class AnalysisService:
    async def get_summary(self, *, user: User) -> dict:
        profile = await HealthProfile.get_or_none(user_id=user.id)

        risk_flags = []
        allergy_alerts = []
        emergency_alerts = []
        seen_emergency_keys: set[str] = set()

        if profile:
            lifestyle_analysis = _analyze_lifestyle(profile.lifestyle_input)
            sleep_analysis = _analyze_sleep(profile.sleep_input)
            nutrition_analysis = _analyze_nutrition(profile.nutrition_input)
            risk_flags = lifestyle_analysis["flags"] + sleep_analysis["flags"] + nutrition_analysis["flags"]

            drug_allergies = profile.basic_info.get("drug_allergies", [])
            if drug_allergies:
                from app.models.ocr import OcrJob  # noqa: PLC0415

                ocr_jobs = await OcrJob.filter(user_id=user.id, status=OcrJobStatus.SUCCEEDED)
                for job in ocr_jobs:
                    result = await OcrResult.get_or_none(job_id=job.id)
                    if not result:
                        continue
                    medications = result.structured_data.get("medications", [])
                    for med in medications:
                        drug_name = str(med.get("drug_name", "") or "")
                        for allergy in drug_allergies:
                            allergy_text = str(allergy or "")
                            if allergy_text and allergy_text.lower() in drug_name.lower():
                                guidance_message = await generate_allergy_medication_guidance(
                                    medication_name=drug_name,
                                    allergy_substance=allergy_text,
                                )
                                alert_key = f"ALLERGY::{allergy_text}::{drug_name}"
                                if alert_key in seen_emergency_keys:
                                    continue
                                seen_emergency_keys.add(alert_key)
                                allergy_alerts.append(
                                    {
                                        "medication_name": drug_name,
                                        "allergy_substance": allergy_text,
                                        "severity": "HIGH",
                                        "message": guidance_message,
                                    }
                                )
                                emergency_alerts.append(
                                    {
                                        "alert_key": alert_key,
                                        "type": "ALLERGY",
                                        "severity": "HIGH",
                                        "title": "알레르기 약물 충돌 가능성",
                                        "message": guidance_message,
                                    }
                                )

            if is_nutrition_guide_condition_1(basic_info=profile.basic_info, nutrition_input=profile.nutrition_input):
                emergency_alerts.append(
                    {
                        "alert_key": "NUTRITION::CONDITION_1",
                        "type": "NUTRITION",
                        "severity": "HIGH",
                        "title": "영양 상태 주의 알림",
                        "message": await generate_nutrition_guidance(),
                    }
                )

            if is_sleep_guide_condition_1(sleep_input=profile.sleep_input):
                emergency_alerts.append(
                    {
                        "alert_key": "SLEEP::CONDITION_1",
                        "type": "SLEEP",
                        "severity": "HIGH",
                        "title": "수면 안전 알림",
                        "message": await generate_sleep_guidance(),
                    }
                )
        else:
            lifestyle_analysis = {}
            sleep_analysis = {}
            nutrition_analysis = {}

        return {
            "basic_info": profile.basic_info if profile else {},
            "lifestyle_analysis": lifestyle_analysis,
            "sleep_analysis": sleep_analysis,
            "nutrition_analysis": nutrition_analysis,
            "risk_flags": risk_flags,
            "allergy_alerts": allergy_alerts,
            "emergency_alerts": emergency_alerts,
        }
