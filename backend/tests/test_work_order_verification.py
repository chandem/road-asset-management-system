import pytest
from pydantic import ValidationError

from app.schemas.work_order_verification import WorkOrderVerificationCreate


def test_verification_accepts_valid_data():
    item = WorkOrderVerificationCreate(
        verified_by="Engineer",
        result="accepted with observations",
        completed_quantity=120.5,
        final_condition="Good",
        gps_latitude=9.03,
        gps_longitude=38.74,
        remarks="Minor shoulder dressing remains.",
    )
    assert item.completed_quantity == 120.5


def test_verification_rejects_negative_quantity():
    with pytest.raises(ValidationError):
        WorkOrderVerificationCreate(verified_by="Engineer", completed_quantity=-1)


def test_verification_requires_verifier():
    with pytest.raises(ValidationError):
        WorkOrderVerificationCreate(verified_by="")
