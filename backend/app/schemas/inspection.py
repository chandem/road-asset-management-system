from datetime import date
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


class InspectionCreate(BaseModel):
    section_id: Optional[int] = None
    inspection_date: date
    inspector_id: Optional[int] = None
    overall_condition: Optional[float] = Field(default=None, ge=0, le=100)
    notes: Optional[str] = None


class InspectionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    inspection_id: int
    road_id: int
    section_id: Optional[int] = None
    inspection_date: date
    inspector_id: Optional[int] = None
    overall_condition: Optional[float] = None
    notes: Optional[str] = None
