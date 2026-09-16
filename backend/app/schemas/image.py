from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


class ImageCreate(BaseModel):
    inspection_id: Optional[int] = None
    defect_id: Optional[int] = None
    file_name: str = Field(min_length=1, max_length=255)
    file_path: str = Field(min_length=1)
    captured_at: Optional[datetime] = None
    latitude: Optional[float] = Field(default=None, ge=-90, le=90)
    longitude: Optional[float] = Field(default=None, ge=-180, le=180)


class ImageResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    image_id: int
    inspection_id: Optional[int] = None
    defect_id: Optional[int] = None
    file_name: str
    file_path: str
    captured_at: Optional[datetime] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
