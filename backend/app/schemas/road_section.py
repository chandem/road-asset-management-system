from typing import Optional

from pydantic import BaseModel, ConfigDict, Field, model_validator


class RoadSectionBase(BaseModel):
    section_code: str = Field(min_length=1, max_length=80)
    start_chainage: float = Field(ge=0)
    end_chainage: float = Field(ge=0)
    length_km: Optional[float] = Field(default=None, ge=0)
    surface_type: Optional[str] = None
    condition_rating: Optional[float] = Field(default=None, ge=0, le=100)
    geometry_wkt: Optional[str] = None

    @model_validator(mode="after")
    def validate_chainage(self):
        if self.end_chainage < self.start_chainage:
            raise ValueError("end_chainage must be greater than or equal to start_chainage")
        return self


class RoadSectionCreate(RoadSectionBase):
    pass


class RoadSectionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    section_id: int
    road_id: int
    section_code: str
    start_chainage: float
    end_chainage: float
    length_km: Optional[float] = None
    surface_type: Optional[str] = None
    condition_rating: Optional[float] = None
