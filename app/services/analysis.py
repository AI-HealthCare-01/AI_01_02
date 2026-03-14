import re
from datetime import date
from typing import Any

from app.models.health_profiles import UserHealthProfile
from app.models.ocr import OcrJob, OcrJobStatus
from app.models.psych_drugs import PsychDrug
from app.models.users import User
from app.services.emergency_guidance import (
    generate_allergy_medication_guidance,
    generate_nutrition_guidance,
    generate_sleep_guidance,
    is_nutrition_guide_condition_1,
    is_sleep_guide_condition_1,
)
from app.services.psych_drugs import PsychDrugService


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


def _serialize_basic_info(profile: UserHealthProfile) -> dict[str, Any]:
    return {
        "height_cm": profile.height_cm,
        "weight_kg": profile.weight_kg,
        "drug_allergies": profile.drug_allergies,
    }


def _serialize_lifestyle_input(profile: UserHealthProfile) -> dict[str, Any]:
    return {
        "exercise_hours": {
            "low_intensity": max(profile.exercise_frequency_per_week, 0),
            "moderate_intensity": 0,
            "high_intensity": 0,
        },
        "digital_usage": {
            "pc_hours_per_day": profile.pc_hours_per_day,
            "smartphone_hours_per_day": profile.smartphone_hours_per_day,
        },
        "substance_usage": {
            "caffeine_cups_per_day": profile.caffeine_cups_per_day,
            "smoking": profile.smoking,
            "alcohol_frequency_per_week": profile.alcohol_frequency_per_week,
        },
    }


def _serialize_sleep_input(profile: UserHealthProfile) -> dict[str, Any]:
    return {
        "bed_time": profile.bed_time,
        "wake_time": profile.wake_time,
        "sleep_latency_minutes": profile.sleep_latency_minutes,
        "night_awakenings_per_week": profile.night_awakenings_per_week,
        "daytime_sleepiness_score": profile.daytime_sleepiness,
    }


def _serialize_nutrition_input(profile: UserHealthProfile) -> dict[str, Any]:
    return {
        "appetite_score": profile.appetite_level,
        "is_meal_regular": profile.meal_regular,
    }


def _extract_medications_from_ocr_job(job: OcrJob) -> list[dict[str, Any]]:
    confirmed = job.confirmed_result if isinstance(job.confirmed_result, dict) else {}
    structured = job.structured_result if isinstance(job.structured_result, dict) else {}

    medications = confirmed.get("extracted_medications")
    if isinstance(medications, list):
        return [m for m in medications if isinstance(m, dict)]

    medications = structured.get("extracted_medications")
    if isinstance(medications, list):
        return [m for m in medications if isinstance(m, dict)]

    medications = structured.get("medications")
    if isinstance(medications, list):
        return [m for m in medications if isinstance(m, dict)]

    confirmed_ocr = confirmed.get("confirmed_ocr") if isinstance(confirmed, dict) else None
    if not isinstance(confirmed_ocr, dict):
        confirmed_ocr = structured.get("confirmed_ocr") if isinstance(structured, dict) else None
    if not isinstance(confirmed_ocr, dict):
        return []

    extracted = confirmed_ocr.get("extracted_medications")
    if not isinstance(extracted, list):
        return []
    return [m for m in extracted if isinstance(m, dict)]


def _normalize_drug_text(text: str) -> str:
    return "".join(ch for ch in text.lower() if ch.isalnum())


def _build_ingredient_candidates(text: str) -> set[str]:
    cleaned = str(text or "").strip()
    if not cleaned:
        return set()

    candidates = {_normalize_drug_text(cleaned)}
    parts = re.split(r"\s*(?:,|/|\+|;|\||·|및)\s*", cleaned)
    for part in parts:
        normalized = _normalize_drug_text(part)
        if normalized:
            candidates.add(normalized)
    return {candidate for candidate in candidates if candidate}


async def _resolve_allergy_ingredient(allergy_text: str, psych_drug_service: PsychDrugService) -> tuple[str, set[str]]:
    normalized_candidates = _build_ingredient_candidates(allergy_text)
    cleaned = str(allergy_text or "").strip()
    if not cleaned:
        return "", normalized_candidates

    ingredient_match = await PsychDrug.filter(ingredient_name__iexact=cleaned).order_by("ingredient_name").first()
    if not ingredient_match:
        ingredient_match = (
            await PsychDrug.filter(ingredient_name__icontains=cleaned).order_by("ingredient_name").first()
        )
    if ingredient_match and ingredient_match.ingredient_name:
        ingredient = str(ingredient_match.ingredient_name).strip()
        return ingredient, _build_ingredient_candidates(ingredient)

    product_match = await psych_drug_service.find_best_match(product_name=cleaned)
    if product_match and product_match.ingredient_name:
        ingredient = str(product_match.ingredient_name).strip()
        return ingredient, _build_ingredient_candidates(ingredient)

    return cleaned, normalized_candidates


async def _resolve_prescribed_ingredient(drug_name: str, psych_drug_service: PsychDrugService) -> tuple[str, set[str]]:
    cleaned = str(drug_name or "").strip()
    if not cleaned:
        return "", set()

    product_match = await psych_drug_service.find_best_match(product_name=cleaned)
    if product_match and product_match.ingredient_name:
        ingredient = str(product_match.ingredient_name).strip()
        return ingredient, _build_ingredient_candidates(ingredient)

    return cleaned, _build_ingredient_candidates(cleaned)


class AnalysisService:
    async def get_summary(self, *, user: User, date_from: date | None = None, date_to: date | None = None) -> dict:
        profile = await UserHealthProfile.get_or_none(user_id=user.id)

        risk_flags = []
        allergy_alerts = []
        emergency_alerts = []
        seen_emergency_keys: set[str] = set()
        psych_drug_service = PsychDrugService()

        if profile:
            basic_info = _serialize_basic_info(profile)
            lifestyle_input = _serialize_lifestyle_input(profile)
            sleep_input = _serialize_sleep_input(profile)
            nutrition_input = _serialize_nutrition_input(profile)

            lifestyle_analysis = _analyze_lifestyle(lifestyle_input)
            sleep_analysis = _analyze_sleep(sleep_input)
            nutrition_analysis = _analyze_nutrition(nutrition_input)
            risk_flags = lifestyle_analysis["flags"] + sleep_analysis["flags"] + nutrition_analysis["flags"]

            drug_allergies = basic_info.get("drug_allergies", [])
            if drug_allergies:
                await self._check_allergy_conflicts(
                    user=user,
                    profile=profile,
                    drug_allergies=drug_allergies,
                    psych_drug_service=psych_drug_service,
                    allergy_alerts=allergy_alerts,
                    emergency_alerts=emergency_alerts,
                    seen_emergency_keys=seen_emergency_keys,
                )

            if is_nutrition_guide_condition_1(basic_info=basic_info, nutrition_input=nutrition_input):
                emergency_alerts.append(
                    {
                        "alert_key": "NUTRITION::CONDITION_1",
                        "type": "NUTRITION",
                        "severity": "HIGH",
                        "title": "영양 상태 주의 알림",
                        "message": await generate_nutrition_guidance(),
                        "profile_updated_at": profile.updated_at.isoformat() if profile.updated_at else "",
                    }
                )

            if is_sleep_guide_condition_1(sleep_input=sleep_input):
                emergency_alerts.append(
                    {
                        "alert_key": "SLEEP::CONDITION_1",
                        "type": "SLEEP",
                        "severity": "HIGH",
                        "title": "수면 안전 알림",
                        "message": await generate_sleep_guidance(),
                        "profile_updated_at": profile.updated_at.isoformat() if profile.updated_at else "",
                    }
                )
        else:
            basic_info = {}
            lifestyle_analysis = {}
            sleep_analysis = {}
            nutrition_analysis = {}

        return {
            "basic_info": basic_info,
            "lifestyle_analysis": lifestyle_analysis,
            "sleep_analysis": sleep_analysis,
            "nutrition_analysis": nutrition_analysis,
            "risk_flags": risk_flags,
            "allergy_alerts": allergy_alerts,
            "emergency_alerts": emergency_alerts,
        }

    async def _check_allergy_conflicts(
        self,
        *,
        user: User,
        profile: UserHealthProfile,
        drug_allergies: list[str],
        psych_drug_service: PsychDrugService,
        allergy_alerts: list[dict[str, Any]],
        emergency_alerts: list[dict[str, Any]],
        seen_emergency_keys: set[str],
    ) -> None:
        resolved_allergies: dict[str, tuple[str, set[str]]] = {}
        for allergy in drug_allergies:
            allergy_text = str(allergy or "")
            if allergy_text and allergy_text not in resolved_allergies:
                resolved_allergies[allergy_text] = await _resolve_allergy_ingredient(allergy_text, psych_drug_service)

        ocr_jobs = await OcrJob.filter(user_id=user.id, status=OcrJobStatus.SUCCEEDED).order_by("-created_at", "-id")
        resolved_drugs: dict[str, tuple[str, set[str]]] = {}

        for job in ocr_jobs:
            if not job.structured_result:
                continue
            medications = _extract_medications_from_ocr_job(job)
            for med in medications:
                drug_name = str(med.get("drug_name", "") or "")
                if not drug_name:
                    continue
                if drug_name not in resolved_drugs:
                    resolved_drugs[drug_name] = await _resolve_prescribed_ingredient(drug_name, psych_drug_service)
                matched_ingredient, medication_candidates = resolved_drugs[drug_name]
                if not medication_candidates:
                    continue
                for allergy in drug_allergies:
                    allergy_text = str(allergy or "")
                    resolved_allergy, allergy_candidates = resolved_allergies.get(allergy_text, ("", set()))
                    if not allergy_candidates or allergy_candidates.isdisjoint(medication_candidates):
                        continue

                    canonical_ingredient = resolved_allergy or matched_ingredient or allergy_text
                    alert_key = f"ALLERGY::{canonical_ingredient}::{drug_name}"
                    if alert_key in seen_emergency_keys:
                        continue
                    seen_emergency_keys.add(alert_key)
                    guidance_message = await generate_allergy_medication_guidance(
                        medication_name=drug_name,
                        allergy_substance=canonical_ingredient,
                    )
                    allergy_alerts.append(
                        {
                            "medication_name": drug_name,
                            "allergy_substance": canonical_ingredient,
                            "matched_ingredient": matched_ingredient or canonical_ingredient,
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
                            "source_ocr_job_id": job.id,
                            "profile_updated_at": profile.updated_at.isoformat() if profile.updated_at else "",
                        }
                    )
