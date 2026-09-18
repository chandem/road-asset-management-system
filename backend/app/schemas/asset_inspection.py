from datetime import date
from typing import Optional
from pydantic import BaseModel, ConfigDict, Field

class AssetInspectionCreate(BaseModel):
    inspection_date: date
    inspector_id: Optional[int] = None
    condition_rating: Optional[float] = Field(default=None, ge=0, le=100)
    defect_status: Optional[str] = Field(default=None, max_length=50)
    notes: Optional[str] = None

class AssetInspectionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    asset_inspection_id: int
    asset_id: int
    inspection_date: date
    inspector_id: Optional[int] = None
    condition_rating: Optional[float] = None
    defect_status: Optional[str] = None
    notes: Optional[str] = None
