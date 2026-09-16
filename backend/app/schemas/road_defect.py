from typing import Optional

from pydantic import BaseModel, Field, model_validator


class RoadDefectCreate(BaseModel):
    defect_type: str = Field(min_length=1, max_length=80)
    severity: Optional[str] = Field(default=None, max_length=30)
    chainage_start: Optional[float] = Field(default=None, ge=0)
    chainage_end: Optional[float] = Field(default=None, ge=0)
    quantity: Optional[float] = Field(default=None, ge=0)
    unit: Optional[str] = Field(default=None, max_length=30)
    description: Optional[str] = None
    geometry_wkt: Optional[str] = None

    @model_validator(mode="after")
    def validate_chainages(self):
        if (
            self.chainage_start is not None
            and self.chainage_end is not None
            and self.chainage_end < self.chainage_start
        ):
            raise ValueError("chainage_end must be greater than or equal to chainage_start")
        return self


class RoadDefectResponse(BaseModel):
    defect_id: int
    inspection_id: int
    defect_type: str
    severity: Optional[str] = None
    chainage_start: Optional[float] = None
    chainage_end: Optional[float] = None
    quantity: Optional[float] = None
    unit: Optional[str] = None
    description: Optional[str] = None
