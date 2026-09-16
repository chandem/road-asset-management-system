from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


class ChainagePointCreate(BaseModel):
    chainage_km: float = Field(ge=0)
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)
    elevation_m: Optional[float] = None
    utm_zone: Optional[str] = Field(default=None, max_length=20)
    utm_easting: Optional[float] = None
    utm_northing: Optional[float] = None


class ChainagePointResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    point_id: int
    section_id: int
    chainage_km: float
    latitude: float
    longitude: float
    elevation_m: Optional[float] = None
    utm_zone: Optional[str] = None
    utm_easting: Optional[float] = None
    utm_northing: Optional[float] = None
