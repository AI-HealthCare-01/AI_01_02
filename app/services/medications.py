import re

import httpx

from app.core import config
from app.core.logger import default_logger as logger
from app.models.medications import Medication
from app.services.llm import json_completion
from app.services.psych_drugs import PsychDrugService


class MedicationSearchService:
    async def search(self, *, q: str, limit: int = 10) -> list[Medication]:
        return await Medication.filter(name_ko__icontains=q, is_active=True).order_by("name_ko").limit(limit)


class MedicationInfoService:
    _BASE_URL = "https://apis.data.go.kr/1471000/DrbEasyDrugInfoService/getDrbEasyDrugList"

    def __init__(self) -> None:
        self.psych_drug_service = PsychDrugService()

    @staticmethod
    def _strip_html(text: str | None) -> str | None:
        if not text:
            return None
        cleaned = re.sub(r"<[^>]+>", " ", text)
        cleaned = re.sub(r"&nbsp;|&nbsp", " ", cleaned)
        cleaned = re.sub(r"\s+", " ", cleaned).strip()
        return cleaned or None

    async def get_info(self, *, name: str, dose_mg: float | None = None) -> dict[str, str | None] | None:
        db_info = await self._get_db_info(name=name, dose_mg=dose_mg)
        if db_info:
            return db_info

        easy_info = await self._get_easy_drug_info(name=name, dose_mg=dose_mg)
        if easy_info:
            return easy_info

        return await self._get_llm_info(name=name, dose_mg=dose_mg)

    async def _get_db_info(self, *, name: str, dose_mg: float | None = None) -> dict[str, str | None] | None:
        record = await self.psych_drug_service.find_best_match(product_name=name, dose_mg=dose_mg)
        if not record:
            return None

        return {
            "item_name": record.product_name or name,
            "efficacy": None,
            "usage": None,
            "warnings": None,
            "precautions": record.precautions,
            "interactions": None,
            "side_effects": record.side_effects,
            "storage": None,
            "source": "DB",
        }

    async def _get_easy_drug_info(self, *, name: str, dose_mg: float | None = None) -> dict[str, str | None] | None:
        service_key = config.EASY_DRUG_INFO_SERVICE_KEY
        if not service_key:
            return None

        names_to_try = [name]
        if dose_mg is not None:
            dose_str = PsychDrugService.format_dose(dose_mg)
            if dose_str and dose_str not in name:
                names_to_try.insert(0, f"{name} {dose_str}mg")

        payload = None
        async with httpx.AsyncClient(timeout=20.0) as client:
            for query_name in names_to_try:
                params = {
                    "ServiceKey": service_key,
                    "itemName": query_name,
                    "type": "json",
                    "numOfRows": 1,
                    "pageNo": 1,
                }
                try:
                    resp = await client.get(self._BASE_URL, params=params)
                    resp.raise_for_status()
                    payload = resp.json()
                except httpx.HTTPError:
                    logger.warning("easy drug info API failed for '%s'", query_name, exc_info=True)
                    payload = None
                    continue
                body = payload.get("response", {}).get("body", {}) if isinstance(payload, dict) else {}
                items = body.get("items", {}).get("item") if isinstance(body, dict) else None
                if items:
                    break
                payload = None

        if not payload:
            return None

        body = payload.get("response", {}).get("body", {}) if isinstance(payload, dict) else {}
        items = body.get("items", {}).get("item") if isinstance(body, dict) else None
        if not items:
            return None

        item = items[0] if isinstance(items, list) else items
        if not isinstance(item, dict):
            return None

        return {
            "item_name": self._strip_html(item.get("itemName")),
            "efficacy": self._strip_html(item.get("efcyQesitm")),
            "usage": self._strip_html(item.get("useMethodQesitm")),
            "warnings": self._strip_html(item.get("atpnWarnQesitm")),
            "precautions": self._strip_html(item.get("atpnQesitm")),
            "interactions": self._strip_html(item.get("intrcQesitm")),
            "side_effects": self._strip_html(item.get("seQesitm")),
            "storage": self._strip_html(item.get("depositMethodQesitm")),
            "source": "EASY_DRUG",
        }

    async def _get_llm_info(self, *, name: str, dose_mg: float | None = None) -> dict[str, str | None] | None:
        if not config.OPENAI_API_KEY:
            return None

        messages = [
            {
                "role": "system",
                "content": (
                    "You are a Korean medication safety assistant. "
                    "Return a JSON object with keys 'precautions' and 'side_effects'. "
                    "Keep each value concise (2-4 short sentences). "
                    "If unsure, provide conservative, general safety guidance. "
                    "Do not include any additional keys."
                ),
            },
            {
                "role": "user",
                "content": f"약품명: {name}{f' {dose_mg}mg' if dose_mg is not None else ''}\\n부작용과 주의사항을 알려줘.",
            },
        ]

        try:
            data = await json_completion(
                model=config.OPENAI_GUIDE_MODEL,
                messages=messages,
                temperature=0.2,
            )
        except Exception:  # noqa: BLE001
            logger.warning("LLM medication info lookup failed for '%s'", name, exc_info=True)
            return None

        precautions = str(data.get("precautions") or "").strip() or None
        side_effects = str(data.get("side_effects") or "").strip() or None
        if not precautions and not side_effects:
            return None

        return {
            "item_name": name,
            "efficacy": None,
            "usage": None,
            "warnings": None,
            "precautions": precautions,
            "interactions": None,
            "side_effects": side_effects,
            "storage": None,
            "source": "LLM",
        }
