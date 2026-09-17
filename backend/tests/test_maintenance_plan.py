import os
from datetime import date

os.environ.setdefault(
    "JWT_SECRET_KEY",
    "test-secret-key-for-rams-unit-tests-32-chars-minimum",
)

import pytest
from fastapi import HTTPException

from app.api.routes.maintenance_plans import _validate_activity_for_plan
from app.models.maintenance_activity import MaintenanceActivity
from app.models.maintenance_plan import MaintenancePlan
from app.schemas.maintenance_plan import MaintenancePlanCreate, MaintenancePlanUpdate


def make_plan(**overrides):
    values = {
        "plan_id": 1,
        "plan_year": 2026,
        "name": "Annual Maintenance",
        "budget": 100000,
        "start_date": date(2026, 1, 1),
        "end_date": date(2026, 12, 31),
        "status": "draft",
    }
    values.update(overrides)
    return MaintenancePlan(**values)


def make_activity(**overrides):
    values = {
        "maintenance_id": 10,
        "road_id": 1,
        "activity_type": "Pothole repair",
        "status": "planned",
    }
    values.update(overrides)
    return MaintenanceActivity(**values)


def test_plan_create_accepts_valid_values():
    plan = MaintenancePlanCreate(
        plan_year=2026,
        name="2026 Road Maintenance",
        budget=500000,
        start_date=date(2026, 1, 1),
        end_date=date(2026, 12, 31),
    )
    assert plan.plan_year == 2026
    assert plan.status == "draft"


def test_plan_create_rejects_negative_budget():
    with pytest.raises(ValueError):
        MaintenancePlanCreate(plan_year=2026, name="Plan", budget=-1)


def test_plan_update_validates_year_and_status():
    update = MaintenancePlanUpdate(plan_year=2027, status="approved")
    assert update.plan_year == 2027
    assert update.status == "approved"


def test_activity_date_inside_plan_is_valid():
    _validate_activity_for_plan(
        make_plan(),
        make_activity(planned_date=date(2026, 6, 15)),
    )


def test_activity_before_plan_is_rejected():
    with pytest.raises(HTTPException) as exc_info:
        _validate_activity_for_plan(
            make_plan(),
            make_activity(planned_date=date(2025, 12, 31)),
        )
    assert exc_info.value.status_code == 400
    assert "before" in exc_info.value.detail


def test_activity_after_plan_is_rejected():
    with pytest.raises(HTTPException) as exc_info:
        _validate_activity_for_plan(
            make_plan(),
            make_activity(planned_date=date(2027, 1, 1)),
        )
    assert exc_info.value.status_code == 400
    assert "after" in exc_info.value.detail


def test_activity_without_planned_date_is_valid():
    _validate_activity_for_plan(make_plan(), make_activity(planned_date=None))
