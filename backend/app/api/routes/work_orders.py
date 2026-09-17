from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import AuthenticatedUser, EngineerUser
from app.db.session import get_db
from app.models.maintenance_activity import MaintenanceActivity
from app.models.work_order import WorkOrder
from app.models.work_order_history import WorkOrderHistory
from app.schemas.work_order import WorkOrderCreate, WorkOrderResponse, WorkOrderUpdate

router = APIRouter(tags=["Work Orders"])
DbSession = Annotated[Session, Depends(get_db)]


def _values(order: WorkOrder) -> dict:
    return {
        "maintenance_id": order.maintenance_id,
        "order_number": order.order_number,
        "issue_date": order.issue_date.isoformat() if order.issue_date else None,
        "due_date": order.due_date.isoformat() if order.due_date else None,
        "status": order.status,
        "assigned_to": order.assigned_to,
        "instructions": order.instructions,
    }


def _add_history(db: Session, order: WorkOrder, user_id: int | None, action: str, old_values=None, new_values=None):
    db.add(WorkOrderHistory(
        work_order_id=order.work_order_id,
        changed_by=user_id,
        action=action,
        changed_at=datetime.now(timezone.utc),
        old_values=old_values,
        new_values=new_values,
    ))


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


@router.get("/work-orders/{work_order_id}/history")
def work_order_history(work_order_id: int, db: DbSession, current_user: AuthenticatedUser):
    if db.get(WorkOrder, work_order_id) is None:
        raise HTTPException(status_code=404, detail="Work order not found")
    return db.scalars(
        select(WorkOrderHistory)
        .where(WorkOrderHistory.work_order_id == work_order_id)
        .order_by(WorkOrderHistory.changed_at.desc(), WorkOrderHistory.history_id.desc())
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
        db.flush()
        _add_history(db, order, current_user.user_id, "created", None, _values(order))
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

    old_values = _values(order)
    old_status = order.status
    for field, value in data.items():
        setattr(order, field, value)
    order.updated_at = datetime.now(timezone.utc)
    new_values = _values(order)
    changed = {key: value for key, value in new_values.items() if old_values.get(key) != value}
    if not changed:
        return order

    action = data.get("status") if "status" in data and data["status"] != old_status else "updated"
    db.add(order)
    try:
        _add_history(db, order, current_user.user_id, action, old_values, changed)
        db.commit()
    except Exception:
        db.rollback()
        raise HTTPException(status_code=400, detail="Could not update work order")
    db.refresh(order)
    return order
