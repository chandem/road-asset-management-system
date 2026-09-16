from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


class RoadAssetCreate(BaseModel):
    asset_type: str = Field(min_length=1, max_length=50)
    asset_code: Optional[str] = Field(default=None, max_length=80)
    section_id: Optional[int] = None
    chainage_km: Optional[float] = Field(default=None, ge=0)
    description: Optional[str] = None
    condition_rating: Optional[float] = Field(default=None, ge=0, le=100)
    geometry_wkt: Optional[str] = None


class RoadAssetResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    asset_id: int
    road_id: int
    section_id: Optional[int] = None
    asset_type: str
    asset_code: Optional[str] = None
    chainage_km: Optional[float] = None
    description: Optional[str] = None
    condition_rating: Optional[float] = None
