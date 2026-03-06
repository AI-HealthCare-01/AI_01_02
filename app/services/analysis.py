from datetime import date

from app.models.ocr import OcrJobStatus
from app.models.profiles import HealthProfile
from app.models.users import User


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
    async def get_summary(self, *, user: User, date_from: date | None = None, date_to: date | None = None) -> dict:
        profile = await HealthProfile.get_or_none(user_id=user.id)

        risk_flags = []
        allergy_alerts = []

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
                    if not job.structured_result:
                        continue
                    medications = job.structured_result.get("extracted_medications", [])
                    for med in medications:
                        drug_name = med.get("drug_name", "")
                        for allergy in drug_allergies:
                            if allergy.lower() in drug_name.lower():
                                allergy_alerts.append(
                                    {
                                        "medication_name": drug_name,
                                        "allergy_substance": allergy,
                                        "severity": "HIGH",
                                        "message": f"{drug_name}이(가) 알러지 물질({allergy})을 포함할 수 있습니다. 즉시 의료진과 상담하세요.",
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
        }
