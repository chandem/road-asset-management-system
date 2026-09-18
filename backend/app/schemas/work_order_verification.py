from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field, field_validator


VERIFICATION_RESULTS = ("accepted", "accepted with observations", "rejected")


class WorkOrderVerificationCreate(BaseModel):
    verified_at: Optional[datetime] = None
    verified_by: str = Field(min_length=1, max_length=200)
    result: str = Field(default="accepted", max_length=30)
    completed_quantity: Optional[float] = Field(default=None, ge=0)
    final_condition: Optional[str] = Field(default=None, max_length=50)
    gps_latitude: Optional[float] = Field(default=None, ge=-90, le=90)
    gps_longitude: Optional[float] = Field(default=None, ge=-180, le=180)
    remarks: Optional[str] = None

    @field_validator("result")
    @classmethod
    def validate_result(cls, value: str) -> str:
        if value not in VERIFICATION_RESULTS:
            raise ValueError("Invalid verification result")
        return value


class WorkOrderVerificationResponse(WorkOrderVerificationCreate):
    verification_id: int
    work_order_id: int
    created_at: datetime
