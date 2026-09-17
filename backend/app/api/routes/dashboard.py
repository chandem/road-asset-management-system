"""Aggregated dashboard metrics for the Overview screen."""

from typing import Annotated, Any

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.security import AuthenticatedUser
from app.db.session import get_db
from app.models.gps_track import GPSTrack
from app.models.inspection import Inspection
from app.models.maintenance_activity import MaintenanceActivity
from app.models.road import Road
from app.models.road_asset import RoadAsset
from app.models.road_defect import RoadDefect
from app.models.road_section import RoadSection
from app.models.work_order import WorkOrder

router = APIRouter(tags=["Dashboard"])
DbSession = Annotated[Session, Depends(get_db)]


def _count(db: Session, model) -> int:
    return int(db.scalar(select(func.count()).select_from(model)) or 0)


@router.get("/dashboard/summary")
def dashboard_summary(db: DbSession, current_user: AuthenticatedUser) -> dict[str, Any]:
    """Single-call counts + lightweight road/section lists for the shell UI."""
    counts = {
        "roads": _count(db, Road),
        "sections": _count(db, RoadSection),
        "assets": _count(db, RoadAsset),
        "inspections": _count(db, Inspection),
        "defects": _count(db, RoadDefect),
        "maintenance": _count(db, MaintenanceActivity),
        "work_orders": _count(db, WorkOrder),
        "gps_tracks": _count(db, GPSTrack),
    }

    roads = [
        {
            "road_id": r.road_id,
            "road_code": r.road_code,
            "road_name": r.road_name,
            "road_class": r.road_class,
            "surface_type": r.surface_type,
            "total_length_km": float(r.total_length_km) if r.total_length_km is not None else None,
            "status": r.status,
        }
        for r in db.scalars(select(Road).order_by(Road.road_id)).all()
    ]

    sections = [
        {
            "section_id": s.section_id,
            "road_id": s.road_id,
            "section_code": s.section_code,
            "start_chainage": float(s.start_chainage) if s.start_chainage is not None else None,
            "end_chainage": float(s.end_chainage) if s.end_chainage is not None else None,
            "length_km": float(s.length_km) if s.length_km is not None else None,
            "surface_type": s.surface_type,
            "condition_rating": float(s.condition_rating) if s.condition_rating is not None else None,
        }
        for s in db.scalars(select(RoadSection).order_by(RoadSection.section_id)).all()
    ]

    return {"counts": counts, "roads": roads, "sections": sections}
