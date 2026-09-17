from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import AuthenticatedUser, EngineerUser
from app.db.session import get_db
from app.models.maintenance_activity import MaintenanceActivity
from app.models.maintenance_plan import MaintenancePlan
from app.schemas.maintenance_activity import MaintenanceActivityResponse
from app.schemas.maintenance_plan import MaintenancePlanCreate, MaintenancePlanResponse

router = APIRouter(tags=["Maintenance Plans"])
DbSession = Annotated[Session, Depends(get_db)]


@router.get("/maintenance-plans", response_model=list[MaintenancePlanResponse])
def list_plans(db: DbSession, current_user: AuthenticatedUser):
    return db.scalars(
        select(MaintenancePlan).order_by(MaintenancePlan.plan_year.desc(), MaintenancePlan.plan_id.desc())
    ).all()


@router.get("/maintenance-plans/{plan_id}", response_model=MaintenancePlanResponse)
def get_plan(plan_id: int, db: DbSession, current_user: AuthenticatedUser):
    plan = db.get(MaintenancePlan, plan_id)
    if plan is None:
        raise HTTPException(status_code=404, detail="Maintenance plan not found")
    return plan


@router.get("/maintenance-plans/{plan_id}/activities", response_model=list[MaintenanceActivityResponse])
def list_plan_activities(plan_id: int, db: DbSession, current_user: AuthenticatedUser):
    if db.get(MaintenancePlan, plan_id) is None:
        raise HTTPException(status_code=404, detail="Maintenance plan not found")
    return db.scalars(
        select(MaintenanceActivity)
        .where(MaintenanceActivity.plan_id == plan_id)
        .order_by(MaintenanceActivity.planned_date, MaintenanceActivity.maintenance_id)
    ).all()


@router.post("/maintenance-plans", response_model=MaintenancePlanResponse, status_code=201)
def create_plan(payload: MaintenancePlanCreate, db: DbSession, current_user: EngineerUser):
    if payload.start_date and payload.end_date and payload.end_date < payload.start_date:
        raise HTTPException(status_code=400, detail="end_date cannot be before start_date")

    plan = MaintenancePlan(
        plan_year=payload.plan_year,
        name=payload.name,
        budget=payload.budget,
        start_date=payload.start_date,
        end_date=payload.end_date,
        status=payload.status,
        description=payload.description,
    )
    db.add(plan)
    try:
        db.commit()
        db.refresh(plan)
    except Exception:
        db.rollback()
        raise HTTPException(status_code=400, detail="Could not create maintenance plan")
    return plan


@router.patch("/maintenance-plans/{plan_id}/status", response_model=MaintenancePlanResponse)
def update_plan_status(plan_id: int, status: str, db: DbSession, current_user: EngineerUser):
    allowed = {"draft", "approved", "in progress", "completed", "cancelled"}
    if status not in allowed:
        raise HTTPException(status_code=400, detail="Invalid maintenance plan status")
    plan = db.get(MaintenancePlan, plan_id)
    if plan is None:
        raise HTTPException(status_code=404, detail="Maintenance plan not found")
    plan.status = status
    db.commit()
    db.refresh(plan)
    return plan
