from typing import Any

from pydantic import BaseModel


class AnalysisSummaryResponse(BaseModel):
    basic_info: dict[str, Any]
    lifestyle_analysis: dict[str, Any]
    sleep_analysis: dict[str, Any]
    nutrition_analysis: dict[str, Any]
    risk_flags: list[dict[str, Any]]
    allergy_alerts: list[dict[str, Any]]
    emergency_alerts: list[dict[str, Any]]
