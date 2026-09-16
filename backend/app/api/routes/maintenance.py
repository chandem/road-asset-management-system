from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import AuthenticatedUser, EngineerUser
from app.db.session import get_db
from app.models.maintenance_activity import MaintenanceActivity
from app.models.road import Road
from app.models.road_section import RoadSection
from app.schemas.maintenance_activity import (
    MaintenanceActivityCreate,
    MaintenanceActivityResponse,
)

router = APIRouter(tags=["Maintenance"])
DbSession = Annotated[Session, Depends(get_db)]


@router.get("/roads/{road_id}/maintenance", response_model=list[MaintenanceActivityResponse])
def list_maintenance(road_id: int, db: DbSession, current_user: AuthenticatedUser):
    if db.get(Road, road_id) is None:
        raise HTTPException(status_code=404, detail="Road not found")

    return db.scalars(
        select(MaintenanceActivity)
        .where(MaintenanceActivity.road_id == road_id)
        .order_by(MaintenanceActivity.planned_date, MaintenanceActivity.maintenance_id)
    ).all()


@router.get("/maintenance/{maintenance_id}", response_model=MaintenanceActivityResponse)
def get_maintenance(maintenance_id: int, db: DbSession, current_user: AuthenticatedUser):
    activity = db.get(MaintenanceActivity, maintenance_id)
    if activity is None:
        raise HTTPException(status_code=404, detail="Maintenance activity not found")
    return activity


@router.post(
    "/roads/{road_id}/maintenance",
    response_model=MaintenanceActivityResponse,
    status_code=201,
)
def create_maintenance(
    road_id: int,
    payload: MaintenanceActivityCreate,
    db: DbSession,
    current_user: EngineerUser,
):
    if db.get(Road, road_id) is None:
        raise HTTPException(status_code=404, detail="Road not found")

    if payload.section_id is not None:
        section = db.get(RoadSection, payload.section_id)
        if section is None or section.road_id != road_id:
            raise HTTPException(status_code=400, detail="Section does not belong to this road")

    if (
        payload.planned_date is not None
        and payload.completed_date is not None
        and payload.completed_date < payload.planned_date
    ):
        raise HTTPException(status_code=400, detail="completed_date cannot be before planned_date")

    activity = MaintenanceActivity(
        road_id=road_id,
        section_id=payload.section_id,
        activity_type=payload.activity_type,
        priority=payload.priority,
        planned_date=payload.planned_date,
        completed_date=payload.completed_date,
        estimated_cost=payload.estimated_cost,
        actual_cost=payload.actual_cost,
        contractor=payload.contractor,
        status=payload.status,
        description=payload.description,
    )

    db.add(activity)
    try:
        db.commit()
    except Exception:
        db.rollback()
        raise HTTPException(status_code=400, detail="Could not create maintenance activity")

    db.refresh(activity)
    return activity
