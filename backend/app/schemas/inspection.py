from datetime import date
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


class InspectionCreate(BaseModel):
    inspection_date: date
    inspector_id: Optional[int] = None
    condition_rating: Optional[float] = Field(default=None, ge=0, le=100)
    weather: Optional[str] = Field(default=None, max_length=100)
    notes: Optional[str] = None


class InspectionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    inspection_id: int
    section_id: int
    inspector_id: Optional[int] = None
    inspection_date: date
    condition_rating: Optional[float] = None
    weather: Optional[str] = None
    notes: Optional[str] = None
