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


class RoadUpdate(BaseModel):
    road_code: Optional[str] = Field(default=None, min_length=1, max_length=50)
    road_name: Optional[str] = Field(default=None, min_length=1, max_length=200)
    road_class: Optional[str] = None
    surface_type: Optional[str] = None
    start_location: Optional[str] = None
    end_location: Optional[str] = None
    total_length_km: Optional[float] = Field(default=None, ge=0)
    status: Optional[str] = None
    organization_id: Optional[int] = None
    geometry_wkt: Optional[str] = None


class RoadResponse(RoadBase):
    model_config = ConfigDict(from_attributes=True)

    road_id: int
    organization_id: Optional[int] = None


class RoadGeoJSONProperties(BaseModel):
    road_id: int
    road_code: str
    road_name: str
    road_class: Optional[str] = None
    surface_type: Optional[str] = None
    total_length_km: Optional[float] = None
    status: str


class RoadGeoJSONFeature(BaseModel):
    type: str = "Feature"
    geometry: Optional[dict] = None
    properties: RoadGeoJSONProperties


class RoadGeoJSONResponse(BaseModel):
    type: str = "FeatureCollection"
    features: list[RoadGeoJSONFeature]


class GenerateSectionsRequest(BaseModel):
    section_length_m: float = Field(default=500, gt=0, le=10000)
    replace_existing: bool = False


class GenerateSectionsResponse(BaseModel):
    road_id: int
    sections_created: int
    section_length_m: float
    total_length_km: float
