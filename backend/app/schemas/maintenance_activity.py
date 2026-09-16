from datetime import date
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


class MaintenanceActivityCreate(BaseModel):
    section_id: Optional[int] = None
    activity_type: str = Field(min_length=1, max_length=80)
    planned_date: Optional[date] = None
    completed_date: Optional[date] = None
    contractor: Optional[str] = Field(default=None, max_length=200)
    estimated_cost: Optional[float] = Field(default=None, ge=0)
    actual_cost: Optional[float] = Field(default=None, ge=0)
    status: str = Field(default="planned", max_length=30)
    description: Optional[str] = None


class MaintenanceActivityResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    activity_id: int
    road_id: int
    section_id: Optional[int] = None
    activity_type: str
    planned_date: Optional[date] = None
    completed_date: Optional[date] = None
    contractor: Optional[str] = None
    estimated_cost: Optional[float] = None
    actual_cost: Optional[float] = None
    status: str
    description: Optional[str] = None
