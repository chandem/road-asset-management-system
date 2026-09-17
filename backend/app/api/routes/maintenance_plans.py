from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import AuthenticatedUser, EngineerUser
from app.db.session import get_db
from app.models.maintenance_activity import MaintenanceActivity
from app.models.maintenance_plan import MaintenancePlan
from app.schemas.maintenance_activity import MaintenanceActivityResponse
from app.schemas.maintenance_plan import (
    MaintenancePlanCreate,
    MaintenancePlanResponse,
    MaintenancePlanUpdate,
)

router = APIRouter(tags=["Maintenance Plans"])
DbSession = Annotated[Session, Depends(get_db)]


@router.get("/maintenance-plans", response_model=list[MaintenancePlanResponse])
def list_plans(db: DbSession, current_user: AuthenticatedUser):
    return db.scalars(
        select(MaintenancePlan).order_by(
            MaintenancePlan.plan_year.desc(), MaintenancePlan.plan_id.desc()
        )
    ).all()


@router.get("/maintenance-plans/{plan_id}", response_model=MaintenancePlanResponse)
def get_plan(plan_id: int, db: DbSession, current_user: AuthenticatedUser):
    plan = db.get(MaintenancePlan, plan_id)
    if plan is None:
        raise HTTPException(status_code=404, detail="Maintenance plan not found")
    return plan


@router.get(
    "/maintenance-plans/{plan_id}/activities",
    response_model=list[MaintenanceActivityResponse],
)
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


@router.patch("/maintenance-plans/{plan_id}", response_model=MaintenancePlanResponse)
def update_plan(
    plan_id: int,
    payload: MaintenancePlanUpdate,
    db: DbSession,
    current_user: EngineerUser,
):
    plan = db.get(MaintenancePlan, plan_id)
    if plan is None:
        raise HTTPException(status_code=404, detail="Maintenance plan not found")

    values = payload.model_dump(exclude_unset=True)
    for field, value in values.items():
        setattr(plan, field, value)

    if plan.start_date and plan.end_date and plan.end_date < plan.start_date:
        db.rollback()
        raise HTTPException(status_code=400, detail="end_date cannot be before start_date")

    db.commit()
    db.refresh(plan)
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


def _validate_activity_for_plan(plan: MaintenancePlan, activity: MaintenanceActivity) -> None:
    if activity.planned_date is None:
        return
    if plan.start_date and activity.planned_date < plan.start_date:
        raise HTTPException(status_code=400, detail="Activity planned_date is before the plan start_date")
    if plan.end_date and activity.planned_date > plan.end_date:
        raise HTTPException(status_code=400, detail="Activity planned_date is after the plan end_date")


@router.post(
    "/maintenance-plans/{plan_id}/activities/{maintenance_id}",
    response_model=MaintenanceActivityResponse,
)
def assign_activity_to_plan(
    plan_id: int,
    maintenance_id: int,
    db: DbSession,
    current_user: EngineerUser,
):
    plan = db.get(MaintenancePlan, plan_id)
    if plan is None:
        raise HTTPException(status_code=404, detail="Maintenance plan not found")

    activity = db.get(MaintenanceActivity, maintenance_id)
    if activity is None:
        raise HTTPException(status_code=404, detail="Maintenance activity not found")

    _validate_activity_for_plan(plan, activity)
    activity.plan_id = plan_id
    db.commit()
    db.refresh(activity)
    return activity


@router.delete(
    "/maintenance-plans/{plan_id}/activities/{maintenance_id}",
    response_model=MaintenanceActivityResponse,
)
def unassign_activity_from_plan(
    plan_id: int,
    maintenance_id: int,
    db: DbSession,
    current_user: EngineerUser,
):
    if db.get(MaintenancePlan, plan_id) is None:
        raise HTTPException(status_code=404, detail="Maintenance plan not found")

    activity = db.get(MaintenanceActivity, maintenance_id)
    if activity is None:
        raise HTTPException(status_code=404, detail="Maintenance activity not found")
    if activity.plan_id != plan_id:
        raise HTTPException(status_code=400, detail="Maintenance activity is not assigned to this plan")

    activity.plan_id = None
    db.commit()
    db.refresh(activity)
    return activity
