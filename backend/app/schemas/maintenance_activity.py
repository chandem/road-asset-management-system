from datetime import date
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


class MaintenanceActivityCreate(BaseModel):
    section_id: Optional[int] = None
    activity_type: str = Field(min_length=1, max_length=100)
    priority: Optional[str] = Field(default=None, max_length=30)
    planned_date: Optional[date] = None
    completed_date: Optional[date] = None
    estimated_cost: Optional[float] = Field(default=None, ge=0)
    actual_cost: Optional[float] = Field(default=None, ge=0)
    contractor: Optional[str] = Field(default=None, max_length=200)
    status: str = Field(default="planned", max_length=30)
    description: Optional[str] = None


class MaintenanceActivityResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    maintenance_id: int
    road_id: Optional[int] = None
    section_id: Optional[int] = None
    activity_type: str
    priority: Optional[str] = None
    planned_date: Optional[date] = None
    completed_date: Optional[date] = None
    estimated_cost: Optional[float] = None
    actual_cost: Optional[float] = None
    contractor: Optional[str] = None
    status: str
    description: Optional[str] = None
