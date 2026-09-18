from types import SimpleNamespace

from app.api.routes.road_assets import _replacement_plan


def asset(**overrides):
    values = {
        "asset_id": 1,
        "road_id": 10,
        "section_id": 2,
        "asset_type": "culvert",
        "asset_code": "CUL-001",
        "condition_rating": 80,
        "criticality": 3,
        "commissioning_year": 2018,
        "expected_life_years": 20,
        "replacement_cost": 100000,
        "replacement_threshold": 40,
    }
    values.update(overrides)
    return SimpleNamespace(**values)


def test_replacement_plan_calculates_age_and_remaining_life():
    plan = _replacement_plan(asset(), year=2026)
    assert plan["age_years"] == 8
    assert plan["remaining_useful_life_years"] == 12
    assert plan["replacement_due"] is False
    assert plan["replacement_priority"] == "low"


def test_condition_can_make_replacement_due():
    plan = _replacement_plan(asset(condition_rating=35), year=2026)
    assert plan["replacement_due"] is True
    assert plan["replacement_priority"] == "critical"


def test_end_of_service_life_is_critical():
    plan = _replacement_plan(
        asset(commissioning_year=2000, expected_life_years=25),
        year=2026,
    )
    assert plan["remaining_useful_life_years"] == -1
    assert plan["replacement_due"] is True
    assert plan["replacement_priority"] == "critical"


def test_missing_age_data_does_not_fake_remaining_life():
    plan = _replacement_plan(asset(commissioning_year=None, expected_life_years=20))
    assert plan["age_years"] is None
    assert plan["remaining_useful_life_years"] is None
