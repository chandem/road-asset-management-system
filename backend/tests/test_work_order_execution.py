from datetime import datetime, timezone

import pytest
from pydantic import ValidationError

from app.schemas.work_order_execution import WorkOrderExecutionCreate


def test_execution_rejects_negative_quantity():
    with pytest.raises(ValidationError):
        WorkOrderExecutionCreate(planned_quantity=-1)


def test_execution_rejects_completed_before_started():
    started = datetime(2026, 9, 18, 8, tzinfo=timezone.utc)
    completed = datetime(2026, 9, 18, 7, tzinfo=timezone.utc)
    with pytest.raises(ValidationError):
        WorkOrderExecutionCreate(started_at=started, completed_at=completed)


def test_execution_accepts_gps_and_actual_cost():
    item = WorkOrderExecutionCreate(
        crew="Crew A",
        equipment="Grader",
        materials="Gravel",
        planned_quantity=100,
        actual_quantity=105.5,
        quantity_unit="m3",
        actual_cost=125000,
        gps_latitude=7.05,
        gps_longitude=39.72,
        notes="Completed first pass.",
    )
    assert item.actual_quantity == 105.5
    assert item.actual_cost == 125000
