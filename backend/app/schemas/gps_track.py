from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


class GPSTrackCreate(BaseModel):
    recorded_by: Optional[int] = None
    recorded_at: Optional[datetime] = None
    source: Optional[str] = Field(default=None, max_length=50)
    geometry_wkt: str = Field(min_length=1)
    length_km: Optional[float] = Field(default=None, ge=0)


class GPSTrackResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    track_id: int
    road_id: Optional[int] = None
    recorded_by: Optional[int] = None
    recorded_at: datetime
    source: Optional[str] = None
    length_km: Optional[float] = None
