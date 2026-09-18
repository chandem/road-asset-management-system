from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field, model_validator


class WorkOrderExecutionCreate(BaseModel):
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    crew: Optional[str] = None
    equipment: Optional[str] = None
    materials: Optional[str] = None
    planned_quantity: Optional[float] = Field(default=None, ge=0)
    actual_quantity: Optional[float] = Field(default=None, ge=0)
    quantity_unit: Optional[str] = Field(default=None, max_length=50)
    actual_cost: Optional[float] = Field(default=None, ge=0)
    gps_latitude: Optional[float] = Field(default=None, ge=-90, le=90)
    gps_longitude: Optional[float] = Field(default=None, ge=-180, le=180)
    notes: Optional[str] = None

    @model_validator(mode="after")
    def validate_dates(self):
        if self.started_at and self.completed_at and self.completed_at < self.started_at:
            raise ValueError("completed_at cannot be before started_at")
        return self


class WorkOrderExecutionUpdate(WorkOrderExecutionCreate):
    pass


class WorkOrderExecutionResponse(WorkOrderExecutionCreate):
    execution_id: int
    work_order_id: int
    created_at: datetime
    updated_at: datetime
