from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


class AIDetectionResultCreate(BaseModel):
    model_name: str = Field(min_length=1, max_length=200)
    model_version: Optional[str] = Field(default=None, max_length=100)
    defect_type: str = Field(min_length=1, max_length=100)
    confidence: Optional[float] = Field(default=None, ge=0, le=1)
    bounding_box: Optional[dict] = None


class AIDetectionResultResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    detection_id: int
    image_id: int
    model_name: str
    model_version: Optional[str] = None
    defect_type: str
    confidence: Optional[float] = None
    bounding_box: Optional[dict] = None
    detected_at: datetime
