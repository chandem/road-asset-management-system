from datetime import date, datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import AuthenticatedUser, EngineerUser
from app.db.session import get_db
from app.models.maintenance_activity import MaintenanceActivity
from app.models.maintenance_history import MaintenanceHistory
from app.models.road import Road
from app.models.road_defect import RoadDefect
from app.models.road_section import RoadSection
from app.schemas.maintenance_activity import (
    MaintenanceActivityCreate,
    MaintenanceActivityResponse,
    MaintenanceActivityUpdate,
)

router = APIRouter(tags=["Maintenance"])
DbSession = Annotated[Session, Depends(get_db)]


AUDIT_FIELDS = (
    "road_id", "asset_id", "section_id", "source_defect_id", "activity_type", "priority", "chainage_km",
    "planned_date", "completed_date", "estimated_cost", "actual_cost", "contractor", "status", "description",
)


def _serialize_value(value):
    if isinstance(value, (date, datetime)):
        return value.isoformat()
    return value


def _activity_values(activity: MaintenanceActivity) -> dict:
    return {field: _serialize_value(getattr(activity, field)) for field in AUDIT_FIELDS}


def _add_history(db: Session, activity: MaintenanceActivity, changed_by: int | None, action: str,
                 old_values: dict | None = None, new_values: dict | None = None):
    db.add(MaintenanceHistory(
        maintenance_id=activity.maintenance_id,
        changed_by=changed_by,
        action=action,
        changed_at=datetime.now(timezone.utc),
        old_values=old_values,
        new_values=new_values,
    ))


@router.get("/roads/{road_id}/maintenance", response_model=list[MaintenanceActivityResponse])
def list_maintenance(road_id: int, db: DbSession, current_user: AuthenticatedUser):
    if db.get(Road, road_id) is None:
        raise HTTPException(status_code=404, detail="Road not found")
    return db.scalars(select(MaintenanceActivity).where(MaintenanceActivity.road_id == road_id)
                      .order_by(MaintenanceActivity.planned_date, MaintenanceActivity.maintenance_id)).all()


@router.get("/defects/{defect_id}/maintenance", response_model=list[MaintenanceActivityResponse])
def list_defect_maintenance(defect_id: int, db: DbSession, current_user: AuthenticatedUser):
    if db.get(RoadDefect, defect_id) is None:
        raise HTTPException(status_code=404, detail="Defect not found")
    return db.scalars(select(MaintenanceActivity).where(MaintenanceActivity.source_defect_id == defect_id)
                      .order_by(MaintenanceActivity.planned_date, MaintenanceActivity.maintenance_id)).all()


@router.get("/assets/{asset_id}/maintenance", response_model=list[MaintenanceActivityResponse])
def list_asset_maintenance(asset_id: int, db: DbSession, current_user: AuthenticatedUser):
    from app.models.road_asset import RoadAsset
    if db.get(RoadAsset, asset_id) is None:
        raise HTTPException(status_code=404, detail="Road asset not found")
    return db.scalars(
        select(MaintenanceActivity)
        .where(MaintenanceActivity.asset_id == asset_id)
        .order_by(MaintenanceActivity.planned_date.desc(), MaintenanceActivity.maintenance_id.desc())
    ).all()


@router.get("/maintenance/{maintenance_id}", response_model=MaintenanceActivityResponse)
def get_maintenance(maintenance_id: int, db: DbSession, current_user: AuthenticatedUser):
    activity = db.get(MaintenanceActivity, maintenance_id)
    if activity is None:
        raise HTTPException(status_code=404, detail="Maintenance activity not found")
    return activity


@router.get("/maintenance/{maintenance_id}/history")
def list_maintenance_history(maintenance_id: int, db: DbSession, current_user: AuthenticatedUser):
    if db.get(MaintenanceActivity, maintenance_id) is None:
        raise HTTPException(status_code=404, detail="Maintenance activity not found")
    return db.scalars(select(MaintenanceHistory).where(MaintenanceHistory.maintenance_id == maintenance_id)
                      .order_by(MaintenanceHistory.changed_at.desc(), MaintenanceHistory.history_id.desc())).all()


def _validate_links(db: Session, road_id: int, section_id: int | None, source_defect_id: int | None,
                    chainage_km: float | None = None, asset_id: int | None = None):
    section = None
    if asset_id is not None:
        from app.models.road_asset import RoadAsset
        asset = db.get(RoadAsset, asset_id)
        if asset is None or asset.road_id != road_id:
            raise HTTPException(status_code=400, detail="Asset does not belong to this road")
        if section_id is not None and asset.section_id is not None and asset.section_id != section_id:
            raise HTTPException(status_code=400, detail="Asset does not belong to the selected section")

    if section_id is not None:
        section = db.get(RoadSection, section_id)
        if section is None or section.road_id != road_id:
            raise HTTPException(status_code=400, detail="Section does not belong to this road")

    if source_defect_id is not None:
        defect = db.get(RoadDefect, source_defect_id)
        if defect is None:
            raise HTTPException(status_code=404, detail="Source defect not found")
        defect_section = db.get(RoadSection, defect.section_id)
        if defect_section is None or defect_section.road_id != road_id:
            raise HTTPException(status_code=400, detail="Source defect does not belong to this road")
        if section is not None and defect.section_id != section.section_id:
            raise HTTPException(status_code=400, detail="Source defect does not belong to the selected section")

    if chainage_km is not None:
        if section is None:
            raise HTTPException(status_code=400, detail="section_id is required when chainage_km is provided")
        if chainage_km < float(section.start_chainage) or chainage_km > float(section.end_chainage):
            raise HTTPException(status_code=400, detail="chainage_km must be within the selected road section range")


def _validate_dates(planned_date, completed_date):
    if planned_date is not None and completed_date is not None and completed_date < planned_date:
        raise HTTPException(status_code=400, detail="completed_date cannot be before planned_date")


@router.post("/roads/{road_id}/maintenance", response_model=MaintenanceActivityResponse, status_code=201)
def create_maintenance(road_id: int, payload: MaintenanceActivityCreate, db: DbSession, current_user: EngineerUser):
    if db.get(Road, road_id) is None:
        raise HTTPException(status_code=404, detail="Road not found")
    _validate_links(db, road_id, payload.section_id, payload.source_defect_id, payload.chainage_km, asset_id=payload.asset_id)
    _validate_dates(payload.planned_date, payload.completed_date)

    activity = MaintenanceActivity(
        road_id=road_id, asset_id=payload.asset_id, section_id=payload.section_id, source_defect_id=payload.source_defect_id,
        activity_type=payload.activity_type, priority=payload.priority, chainage_km=payload.chainage_km,
        planned_date=payload.planned_date, completed_date=payload.completed_date,
        estimated_cost=payload.estimated_cost, actual_cost=payload.actual_cost,
        contractor=payload.contractor, status=payload.status, description=payload.description,
    )
    db.add(activity)
    try:
        db.flush()
        _add_history(db, activity, current_user.user_id, "created", new_values=_activity_values(activity))
        db.commit()
    except Exception:
        db.rollback()
        raise HTTPException(status_code=400, detail="Could not create maintenance activity")
    db.refresh(activity)
    return activity


@router.patch("/maintenance/{maintenance_id}", response_model=MaintenanceActivityResponse)
def update_maintenance(maintenance_id: int, payload: MaintenanceActivityUpdate, db: DbSession, current_user: EngineerUser):
    activity = db.get(MaintenanceActivity, maintenance_id)
    if activity is None:
        raise HTTPException(status_code=404, detail="Maintenance activity not found")

    old_values = _activity_values(activity)
    data = payload.model_dump(exclude_unset=True)
    section_id = data.get("section_id", activity.section_id)
    source_defect_id = data.get("source_defect_id", activity.source_defect_id)
    chainage_km = data.get("chainage_km", activity.chainage_km)
    _validate_links(db, activity.road_id, section_id, source_defect_id, chainage_km, asset_id=data.get("asset_id", activity.asset_id))
    _validate_dates(data.get("planned_date", activity.planned_date), data.get("completed_date", activity.completed_date))

    previous_status = activity.status
    for field, value in data.items():
        setattr(activity, field, value)
    if activity.status == "completed" and activity.completed_date is None:
        raise HTTPException(status_code=400, detail="completed_date is required when status is completed")

    new_values = _activity_values(activity)
    changed_fields = {field: {"old": old_values[field], "new": new_values[field]}
                      for field in AUDIT_FIELDS if old_values[field] != new_values[field]}
    action = ("completed" if activity.status == "completed" and previous_status != "completed"
              else "cancelled" if activity.status == "cancelled" and previous_status != "cancelled"
              else "updated")
    try:
        _add_history(db, activity, current_user.user_id, action, old_values=old_values,
                     new_values=changed_fields or new_values)
        db.commit()
    except Exception:
        db.rollback()
        raise HTTPException(status_code=400, detail="Could not update maintenance activity")
    db.refresh(activity)
    return activity
