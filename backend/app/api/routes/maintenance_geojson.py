from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import case, func, select
from sqlalchemy.orm import Session

from app.core.security import AuthenticatedUser
from app.db.session import get_db
from app.models.maintenance_activity import MaintenanceActivity
from app.models.road import Road
from app.models.road_defect import RoadDefect
from app.models.road_section import RoadSection

router = APIRouter(tags=["Maintenance GIS"])
DbSession = Annotated[Session, Depends(get_db)]


@router.get("/roads/{road_id}/maintenance/geojson")
def maintenance_geojson(road_id: int, db: DbSession, current_user: AuthenticatedUser):
    if db.get(Road, road_id) is None:
        raise HTTPException(status_code=404, detail="Road not found")

    fraction = case(
        (RoadSection.end_chainage > RoadSection.start_chainage,
         (MaintenanceActivity.chainage_km - RoadSection.start_chainage) /
         (RoadSection.end_chainage - RoadSection.start_chainage)),
        else_=0.5,
    )
    interpolated = func.ST_LineInterpolatePoint(RoadSection.geometry, func.greatest(0.0, func.least(1.0, fraction)))
    geometry = case(
        (MaintenanceActivity.chainage_km.is_not(None) & RoadSection.geometry.is_not(None), interpolated),
        (RoadDefect.geometry.is_not(None), RoadDefect.geometry),
        (RoadSection.geometry.is_not(None), func.ST_LineInterpolatePoint(RoadSection.geometry, 0.5)),
        else_=None,
    )

    rows = db.execute(
        select(MaintenanceActivity, RoadSection, RoadDefect, func.ST_AsGeoJSON(geometry))
        .outerjoin(RoadSection, MaintenanceActivity.section_id == RoadSection.section_id)
        .outerjoin(RoadDefect, MaintenanceActivity.source_defect_id == RoadDefect.defect_id)
        .where(MaintenanceActivity.road_id == road_id)
        .order_by(MaintenanceActivity.planned_date, MaintenanceActivity.maintenance_id)
    ).all()

    features = []
    for activity, section, defect, geometry_json in rows:
        if not geometry_json:
            continue
        properties = {
            "maintenance_id": activity.maintenance_id,
            "road_id": activity.road_id,
            "section_id": activity.section_id,
            "source_defect_id": activity.source_defect_id,
            "activity_type": activity.activity_type,
            "priority": activity.priority,
            "chainage_km": float(activity.chainage_km) if activity.chainage_km is not None else None,
            "planned_date": activity.planned_date.isoformat() if activity.planned_date else None,
            "completed_date": activity.completed_date.isoformat() if activity.completed_date else None,
            "estimated_cost": float(activity.estimated_cost) if activity.estimated_cost is not None else None,
            "actual_cost": float(activity.actual_cost) if activity.actual_cost is not None else None,
            "contractor": activity.contractor,
            "status": activity.status,
            "location_source": "chainage" if activity.chainage_km is not None else "source_defect" if defect and defect.geometry is not None else "section_midpoint",
        }
        import json
        features.append({"type": "Feature", "geometry": json.loads(geometry_json), "properties": properties})

    return {"type": "FeatureCollection", "features": features}
