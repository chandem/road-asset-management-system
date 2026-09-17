from datetime import date
from typing import Literal, Optional

from pydantic import BaseModel, Field

MaintenancePlanStatus = Literal["draft", "approved", "in progress", "completed", "cancelled"]


class MaintenancePlanCreate(BaseModel):
    plan_year: int = Field(ge=2000, le=2100)
    name: str = Field(min_length=1, max_length=200)
    budget: Optional[float] = Field(default=None, ge=0)
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    status: MaintenancePlanStatus = "draft"
    description: Optional[str] = None


class MaintenancePlanUpdate(BaseModel):
    plan_year: Optional[int] = Field(default=None, ge=2000, le=2100)
    name: Optional[str] = Field(default=None, min_length=1, max_length=200)
    budget: Optional[float] = Field(default=None, ge=0)
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    status: Optional[MaintenancePlanStatus] = None
    description: Optional[str] = None


class MaintenancePlanResponse(BaseModel):
    plan_id: int
    plan_year: int
    name: str
    budget: Optional[float] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    status: MaintenancePlanStatus
    description: Optional[str] = None
