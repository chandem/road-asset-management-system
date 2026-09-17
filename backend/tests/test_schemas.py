"""Unit tests for Pydantic request schemas."""

from datetime import date

import pytest
from pydantic import ValidationError

from app.schemas.inspection import InspectionCreate
from app.schemas.maintenance_plan import MaintenancePlanCreate, MaintenancePlanUpdate
from app.schemas.road import RoadCreate
from app.schemas.road_defect import RoadDefectCreate
from app.schemas.road_section import RoadSectionCreate


def test_road_create_accepts_valid_payload():
    road = RoadCreate(
        road_code="A1",
        road_name="Addis–Adama Expressway",
        total_length_km=78.5,
        status="active",
    )
    assert road.road_code == "A1"
    assert road.total_length_km == 78.5


def test_road_create_rejects_empty_code_and_negative_length():
    with pytest.raises(ValidationError):
        RoadCreate(road_code="", road_name="Named")

    with pytest.raises(ValidationError):
        RoadCreate(road_code="A1", road_name="Named", total_length_km=-1)


def test_road_section_rejects_end_before_start():
    with pytest.raises(ValidationError) as exc_info:
        RoadSectionCreate(
            section_code="S1",
            start_chainage=10.0,
            end_chainage=5.0,
        )
    assert "end_chainage" in str(exc_info.value)


def test_road_section_accepts_equal_chainage_and_condition_bounds():
    section = RoadSectionCreate(
        section_code="S1",
        start_chainage=0,
        end_chainage=0,
        condition_rating=100,
    )
    assert section.start_chainage == section.end_chainage
    assert section.condition_rating == 100

    with pytest.raises(ValidationError):
        RoadSectionCreate(
            section_code="S1",
            start_chainage=0,
            end_chainage=1,
            condition_rating=101,
        )


def test_road_defect_requires_type_and_rejects_blank():
    defect = RoadDefectCreate(defect_type="pothole", severity="high")
    assert defect.defect_type == "pothole"

    with pytest.raises(ValidationError):
        RoadDefectCreate(defect_type="")


def test_inspection_create_condition_rating_bounds():
    inspection = InspectionCreate(
        inspection_date=date(2026, 9, 17),
        condition_rating=75.5,
        client_id="offline-abc",
    )
    assert inspection.condition_rating == 75.5
    assert inspection.client_id == "offline-abc"

    with pytest.raises(ValidationError):
        InspectionCreate(inspection_date=date(2026, 9, 17), condition_rating=-1)

    with pytest.raises(ValidationError):
        InspectionCreate(inspection_date=date(2026, 9, 17), condition_rating=100.1)


def test_maintenance_plan_year_and_status_validation():
    plan = MaintenancePlanCreate(
        plan_year=2026,
        name="FY2026 Routine",
        budget=1_000_000,
        status="draft",
    )
    assert plan.plan_year == 2026

    with pytest.raises(ValidationError):
        MaintenancePlanCreate(plan_year=1999, name="Too old")

    with pytest.raises(ValidationError):
        MaintenancePlanCreate(plan_year=2026, name="Bad status", status="open")

    with pytest.raises(ValidationError):
        MaintenancePlanUpdate(budget=-50)
