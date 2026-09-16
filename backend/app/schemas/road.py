from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


class RoadBase(BaseModel):
    road_code: str = Field(min_length=1, max_length=50)
    road_name: str = Field(min_length=1, max_length=200)
    road_class: Optional[str] = None
    surface_type: Optional[str] = None
    start_location: Optional[str] = None
    end_location: Optional[str] = None
    total_length_km: Optional[float] = Field(default=None, ge=0)
    status: str = "active"


class RoadCreate(RoadBase):
    organization_id: Optional[int] = None
    geometry_wkt: Optional[str] = None


class RoadResponse(RoadBase):
    model_config = ConfigDict(from_attributes=True)

    road_id: int
    organization_id: Optional[int] = None
