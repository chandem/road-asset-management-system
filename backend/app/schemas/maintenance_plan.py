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


class MaintenancePlanSummaryResponse(BaseModel):
    plan_id: int
    activity_count: int
    completed_count: int
    estimated_cost: float
    actual_cost: float
    remaining_budget: Optional[float] = None
    budget_utilization_percent: Optional[float] = None
    priority_counts: dict[str, int]


class MaintenanceOptimizationItem(BaseModel):
    maintenance_id: int
    activity_type: str
    priority: str
    condition_score: Optional[float] = None
    estimated_cost: float
    planned_date: Optional[date] = None
    score: float
    overdue: bool
    cumulative_cost: float
    within_budget: bool


class MaintenanceOptimizationResponse(BaseModel):
    plan_id: int
    budget: Optional[float] = None
    total_candidate_cost: float
    total_recommended_cost: float
    remaining_budget: Optional[float] = None
    recommended_count: int
    excluded_count: int
    recommended: list[MaintenanceOptimizationItem]
    excluded: list[MaintenanceOptimizationItem]
