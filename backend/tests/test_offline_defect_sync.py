from types import SimpleNamespace
from unittest.mock import Mock

import pytest
from fastapi import HTTPException

from app.api.routes.road_defects import create_defect
from app.schemas.road_defect import RoadDefectCreate


def test_create_defect_returns_existing_record_for_duplicate_client_id():
    existing = SimpleNamespace(defect_id=42, client_id="offline-42")
    db = Mock()
    db.scalar.return_value = existing

    payload = RoadDefectCreate(client_id="offline-42", defect_type="pothole")
    result = create_defect(7, payload, db, SimpleNamespace(user_id=1))

    assert result is existing
    db.add.assert_not_called()
    db.commit.assert_not_called()


def test_create_defect_rejects_section_from_different_road():
    inspection = SimpleNamespace(inspection_id=7, section_id=1)
    inspection_section = SimpleNamespace(section_id=1, road_id=10)
    selected_section = SimpleNamespace(section_id=2, road_id=20, start_chainage=1, end_chainage=2)

    db = Mock()
    db.get.side_effect = [inspection, selected_section, inspection_section]
    db.scalar.return_value = None

    payload = RoadDefectCreate(section_id=2, defect_type="pothole")

    with pytest.raises(HTTPException) as exc_info:
        create_defect(7, payload, db, SimpleNamespace(user_id=1))

    assert exc_info.value.status_code == 400
    assert exc_info.value.detail == "Defect section does not belong to the inspection road"
    db.add.assert_not_called()
    db.commit.assert_not_called()
