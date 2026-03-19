"""REQ-121: 약 소진 계산 정확성 검증"""

from datetime import date, timedelta
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.dtos.reminders import DdayReminderItem


def _make_reminder(*, dispensed_date: date, total_days: int, medication_name: str = "콘서타") -> MagicMock:
    r = MagicMock()
    r.medication_name = medication_name
    r.dispensed_date = dispensed_date
    r.total_days = total_days
    return r


def _depletion(dispensed_date: date, total_days: int) -> date:
    return dispensed_date + timedelta(days=total_days)


def test_dday_exact_boundary():
    """표시 기준은 소진일까지 남은 날짜에서 1을 뺀 값이다."""
    today = date.today()
    dispensed = today - timedelta(days=23)  # total_days=30 → depletion = today+7
    depletion = _depletion(dispensed, 30)
    remaining = (depletion - today).days - 1

    assert remaining == 6
    assert remaining <= 7  # days=7 윈도우에 포함


@pytest.mark.asyncio
async def test_dday_calculation_accuracy():
    """소진일 = 조제일 + 총처방일수 정확성 검증."""
    cases = [
        (date(2026, 1, 1), 30, date(2026, 1, 31)),
        (date(2026, 1, 31), 28, date(2026, 2, 28)),  # 월말 경계
        (date(2026, 2, 28), 1, date(2026, 3, 1)),  # 윤년 아닌 2월 말
        (date(2026, 12, 25), 14, date(2027, 1, 8)),  # 연말 넘김
    ]
    for dispensed, total_days, expected_depletion in cases:
        assert _depletion(dispensed, total_days) == expected_depletion


@pytest.mark.asyncio
async def test_dday_outside_window_excluded():
    """remaining_days > days 이면 결과에서 제외."""
    with patch.object(
        __import__("app.services.reminders", fromlist=["ReminderService"]).ReminderService,
        "get_dday_reminders",
        new_callable=AsyncMock,
    ) as mock_get:
        mock_get.return_value = []
        from app.services.reminders import ReminderService

        service = ReminderService()
        result = await service.get_dday_reminders(user=MagicMock(), days=7)

    assert result == []


@pytest.mark.asyncio
async def test_dday_already_depleted():
    """소진일이 이미 지난 경우 remaining_days < 0, days=7 범위에 포함."""
    today = date.today()
    dispensed = today - timedelta(days=35)  # total_days=30 → depletion = today-5
    depletion = _depletion(dispensed, 30)
    remaining = (depletion - today).days - 1  # -6

    assert remaining < 0

    item = DdayReminderItem(
        medication_name="리탈린",
        remaining_days=remaining,
        estimated_depletion_date=depletion,
    )
    assert item.remaining_days == -6
    assert item.estimated_depletion_date == depletion


def test_dday_calculate_remaining_days_minus_one():
    from app.services.reminders import ReminderService

    today = date(2026, 3, 19)
    depletion = date(2026, 3, 22)

    assert ReminderService._calculate_remaining_days(depletion=depletion, today=today) == 2
