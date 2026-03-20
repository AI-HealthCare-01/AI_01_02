from app.services.reminders import ReminderService


def test_extract_dose_text_prefers_dosage_per_once():
    med = {
        "dose": 10.0,
        "dosage_per_once": 1,
    }

    assert ReminderService._extract_dose_text(med) == "1 캡/정"


def test_extract_dose_text_falls_back_to_dose_when_dosage_per_once_missing():
    med = {
        "dose": 10.0,
    }

    assert ReminderService._extract_dose_text(med) == "10.0"
