from datetime import date
from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict, Field

MaintenancePriority = Literal["low", "medium", "high", "critical"]
MaintenanceStatus = Literal["planned", "in progress", "completed", "cancelled"]


class MaintenanceActivityCreate(BaseModel):
    asset_id: Optional[int] = None
    section_id: Optional[int] = None
    source_defect_id: Optional[int] = None
    activity_type: str = Field(min_length=1, max_length=100)
    priority: Optional[MaintenancePriority] = None
    chainage_km: Optional[float] = Field(default=None, ge=0)
    planned_date: Optional[date] = None
    completed_date: Optional[date] = None
    estimated_cost: Optional[float] = Field(default=None, ge=0)
    actual_cost: Optional[float] = Field(default=None, ge=0)
    contractor: Optional[str] = Field(default=None, max_length=200)
    status: MaintenanceStatus = "planned"
    description: Optional[str] = None


class MaintenanceActivityUpdate(BaseModel):
    section_id: Optional[int] = None
    source_defect_id: Optional[int] = None
    activity_type: Optional[str] = Field(default=None, min_length=1, max_length=100)
    priority: Optional[MaintenancePriority] = None
    chainage_km: Optional[float] = Field(default=None, ge=0)
    planned_date: Optional[date] = None
    completed_date: Optional[date] = None
    estimated_cost: Optional[float] = Field(default=None, ge=0)
    actual_cost: Optional[float] = Field(default=None, ge=0)
    contractor: Optional[str] = Field(default=None, max_length=200)
    status: Optional[MaintenanceStatus] = None
    description: Optional[str] = None


class MaintenanceActivityResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    maintenance_id: int
    asset_id: Optional[int] = None
    road_id: Optional[int] = None
    section_id: Optional[int] = None
    source_defect_id: Optional[int] = None
    activity_type: str
    priority: Optional[MaintenancePriority] = None
    chainage_km: Optional[float] = None
    planned_date: Optional[date] = None
    completed_date: Optional[date] = None
    estimated_cost: Optional[float] = None
    actual_cost: Optional[float] = None
    contractor: Optional[str] = None
    status: MaintenanceStatus
    description: Optional[str] = None
