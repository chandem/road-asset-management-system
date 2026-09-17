from datetime import date
from typing import Literal, Optional

from pydantic import BaseModel, Field


WorkOrderStatus = Literal["draft", "issued", "in progress", "completed", "cancelled"]


class WorkOrderCreate(BaseModel):
    maintenance_id: int
    order_number: str = Field(min_length=1, max_length=100)
    issue_date: date
    due_date: Optional[date] = None
    status: WorkOrderStatus = "draft"
    assigned_to: Optional[str] = Field(default=None, max_length=200)
    instructions: Optional[str] = None


class WorkOrderUpdate(BaseModel):
    order_number: Optional[str] = Field(default=None, min_length=1, max_length=100)
    issue_date: Optional[date] = None
    due_date: Optional[date] = None
    status: Optional[WorkOrderStatus] = None
    assigned_to: Optional[str] = Field(default=None, max_length=200)
    instructions: Optional[str] = None


class WorkOrderResponse(BaseModel):
    work_order_id: int
    maintenance_id: int
    order_number: str
    issue_date: date
    due_date: Optional[date] = None
    status: WorkOrderStatus
    assigned_to: Optional[str] = None
    instructions: Optional[str] = None
