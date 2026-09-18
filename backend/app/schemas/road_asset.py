from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


class RoadAssetCreate(BaseModel):
    asset_type: str = Field(min_length=1, max_length=50)
    asset_code: Optional[str] = Field(default=None, max_length=80)
    section_id: Optional[int] = None
    chainage_km: Optional[float] = Field(default=None, ge=0)
    description: Optional[str] = None
    condition_rating: Optional[float] = Field(default=None, ge=0, le=100)
    criticality: int = Field(default=3, ge=1, le=5)
    commissioning_year: Optional[int] = Field(default=None, ge=1900, le=2100)
    expected_life_years: Optional[int] = Field(default=None, ge=1, le=200)
    replacement_cost: Optional[float] = Field(default=None, ge=0)
    replacement_threshold: float = Field(default=40, ge=0, le=100)
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
    criticality: int
    commissioning_year: Optional[int] = None
    expected_life_years: Optional[int] = None
    replacement_cost: Optional[float] = None
    replacement_threshold: float
