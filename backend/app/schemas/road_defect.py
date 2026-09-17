from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


class RoadDefectCreate(BaseModel):
    section_id: Optional[int] = None
    client_id: Optional[str] = Field(default=None, max_length=100)
    defect_type: str = Field(min_length=1, max_length=100)
    severity: Optional[str] = Field(default=None, max_length=30)
    chainage_km: Optional[float] = Field(default=None, ge=0)
    length_m: Optional[float] = Field(default=None, ge=0)
    width_m: Optional[float] = Field(default=None, ge=0)
    depth_mm: Optional[float] = Field(default=None, ge=0)
    description: Optional[str] = None
    detected_by: str = Field(default="manual", max_length=30)
    geometry_wkt: Optional[str] = None


class RoadDefectResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    defect_id: int
    inspection_id: Optional[int] = None
    section_id: Optional[int] = None
    client_id: Optional[str] = None
    defect_type: str
    severity: Optional[str] = None
    chainage_km: Optional[float] = None
    length_m: Optional[float] = None
    width_m: Optional[float] = None
    depth_mm: Optional[float] = None
    description: Optional[str] = None
    detected_by: str
