from datetime import date, datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import AuthenticatedUser, EngineerUser
from app.db.session import get_db
from app.models.maintenance_activity import MaintenanceActivity
from app.models.work_order import WorkOrder
from app.schemas.work_order import WorkOrderCreate, WorkOrderResponse, WorkOrderUpdate

router = APIRouter(tags=["Work Orders"])
DbSession = Annotated[Session, Depends(get_db)]


@router.get("/work-orders", response_model=list[WorkOrderResponse])
def list_work_orders(db: DbSession, current_user: AuthenticatedUser):
    return db.scalars(select(WorkOrder).order_by(WorkOrder.issue_date.desc(), WorkOrder.work_order_id.desc())).all()


@router.get("/maintenance/{maintenance_id}/work-orders", response_model=list[WorkOrderResponse])
def list_maintenance_work_orders(maintenance_id: int, db: DbSession, current_user: AuthenticatedUser):
    if db.get(MaintenanceActivity, maintenance_id) is None:
        raise HTTPException(status_code=404, detail="Maintenance activity not found")
    return db.scalars(
        select(WorkOrder)
        .where(WorkOrder.maintenance_id == maintenance_id)
        .order_by(WorkOrder.issue_date.desc(), WorkOrder.work_order_id.desc())
    ).all()


@router.get("/work-orders/{work_order_id}", response_model=WorkOrderResponse)
def get_work_order(work_order_id: int, db: DbSession, current_user: AuthenticatedUser):
    order = db.get(WorkOrder, work_order_id)
    if order is None:
        raise HTTPException(status_code=404, detail="Work order not found")
    return order


@router.post("/work-orders", response_model=WorkOrderResponse, status_code=201)
def create_work_order(payload: WorkOrderCreate, db: DbSession, current_user: EngineerUser):
    maintenance = db.get(MaintenanceActivity, payload.maintenance_id)
    if maintenance is None:
        raise HTTPException(status_code=404, detail="Maintenance activity not found")
    if payload.due_date is not None and payload.due_date < payload.issue_date:
        raise HTTPException(status_code=400, detail="due_date cannot be before issue_date")
    if maintenance.planned_date is not None and payload.issue_date < maintenance.planned_date:
        raise HTTPException(status_code=400, detail="issue_date cannot be before maintenance planned_date")

    order = WorkOrder(
        maintenance_id=payload.maintenance_id,
        order_number=payload.order_number,
        issue_date=payload.issue_date,
        due_date=payload.due_date,
        status=payload.status,
        assigned_to=payload.assigned_to,
        instructions=payload.instructions,
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
    )
    db.add(order)
    try:
        db.commit()
    except Exception:
        db.rollback()
        raise HTTPException(status_code=400, detail="Could not create work order")
    db.refresh(order)
    return order


@router.patch("/work-orders/{work_order_id}", response_model=WorkOrderResponse)
def update_work_order(
    work_order_id: int,
    payload: WorkOrderUpdate,
    db: DbSession,
    current_user: EngineerUser,
):
    order = db.get(WorkOrder, work_order_id)
    if order is None:
        raise HTTPException(status_code=404, detail="Work order not found")

    data = payload.model_dump(exclude_unset=True)
    issue_date = data.get("issue_date", order.issue_date)
    due_date = data.get("due_date", order.due_date)
    if due_date is not None and due_date < issue_date:
        raise HTTPException(status_code=400, detail="due_date cannot be before issue_date")

    maintenance = db.get(MaintenanceActivity, order.maintenance_id)
    if maintenance is not None and maintenance.planned_date is not None and issue_date < maintenance.planned_date:
        raise HTTPException(status_code=400, detail="issue_date cannot be before maintenance planned_date")

    for field, value in data.items():
        setattr(order, field, value)
    order.updated_at = datetime.now(timezone.utc)
    db.add(order)
    try:
        db.commit()
    except Exception:
        db.rollback()
        raise HTTPException(status_code=400, detail="Could not update work order")
    db.refresh(order)
    return order
