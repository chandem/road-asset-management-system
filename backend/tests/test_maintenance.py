import os
from datetime import date

os.environ.setdefault(
    "JWT_SECRET_KEY",
    "test-secret-key-for-rams-unit-tests-32-chars-minimum",
)

import pytest
from fastapi import HTTPException

from app.api.routes.maintenance import _validate_dates, _validate_links
from app.models.road_defect import RoadDefect
from app.models.road_section import RoadSection
from app.schemas.maintenance_activity import (
    MaintenanceActivityCreate,
    MaintenanceActivityUpdate,
)


class FakeDB:
    def __init__(self, objects):
        self.objects = objects

    def get(self, model, object_id):
        return self.objects.get((model, object_id))


def make_section(section_id, road_id):
    return RoadSection(
        section_id=section_id,
        road_id=road_id,
        section_code=f"SEC-{section_id}",
        start_chainage=0,
        end_chainage=1,
    )


def make_defect(section_id):
    return RoadDefect(
        defect_id=20,
        section_id=section_id,
        defect_type="pothole",
        detected_by="manual",
    )


def test_validate_dates_accepts_same_or_ordered_dates():
    _validate_dates(date(2026, 9, 10), date(2026, 9, 10))
    _validate_dates(date(2026, 9, 10), date(2026, 9, 15))
    _validate_dates(None, date(2026, 9, 15))


def test_validate_dates_rejects_completed_before_planned():
    with pytest.raises(HTTPException) as exc_info:
        _validate_dates(date(2026, 9, 15), date(2026, 9, 10))

    assert exc_info.value.status_code == 400
    assert exc_info.value.detail == "completed_date cannot be before planned_date"


def test_validate_links_accepts_matching_section_and_defect():
    section = make_section(10, 1)
    defect = make_defect(10)
    db = FakeDB({
        (RoadSection, 10): section,
        (RoadDefect, 20): defect,
    })

    _validate_links(db, 1, 10, 20)


def test_validate_links_rejects_section_from_another_road():
    section = make_section(10, 2)
    db = FakeDB({(RoadSection, 10): section})

    with pytest.raises(HTTPException) as exc_info:
        _validate_links(db, 1, 10, None)

    assert exc_info.value.status_code == 400
    assert exc_info.value.detail == "Section does not belong to this road"


def test_validate_links_rejects_defect_from_another_section():
    section = make_section(10, 1)
    defect = make_defect(11)
    db = FakeDB({
        (RoadSection, 10): section,
        (RoadDefect, 20): defect,
    })

    with pytest.raises(HTTPException) as exc_info:
        _validate_links(db, 1, 10, 20)

    assert exc_info.value.status_code == 400
    assert exc_info.value.detail == "Source defect does not belong to the selected section"


def test_validate_links_rejects_defect_from_another_road():
    defect_section = make_section(11, 2)
    defect = make_defect(11)
    db = FakeDB({
        (RoadSection, 11): defect_section,
        (RoadDefect, 20): defect,
    })

    with pytest.raises(HTTPException) as exc_info:
        _validate_links(db, 1, None, 20)

    assert exc_info.value.status_code == 400
    assert exc_info.value.detail == "Source defect does not belong to this road"


def test_validate_links_rejects_missing_source_defect():
    db = FakeDB({})

    with pytest.raises(HTTPException) as exc_info:
        _validate_links(db, 1, None, 20)

    assert exc_info.value.status_code == 404
    assert exc_info.value.detail == "Source defect not found"


def test_maintenance_create_rejects_negative_costs():
    with pytest.raises(ValueError):
        MaintenanceActivityCreate(activity_type="Pothole repair", estimated_cost=-1)

    with pytest.raises(ValueError):
        MaintenanceActivityCreate(activity_type="Pothole repair", actual_cost=-1)


def test_maintenance_update_requires_valid_activity_type_when_supplied():
    with pytest.raises(ValueError):
        MaintenanceActivityUpdate(activity_type="")


def test_maintenance_create_accepts_completed_activity_with_date():
    activity = MaintenanceActivityCreate(
        activity_type="Pothole repair",
        priority="high",
        planned_date=date(2026, 9, 10),
        completed_date=date(2026, 9, 12),
        estimated_cost=1000,
        actual_cost=950,
        status="completed",
    )

    assert activity.status == "completed"
    assert activity.completed_date == date(2026, 9, 12)
    assert activity.estimated_cost == 1000
    assert activity.actual_cost == 950
