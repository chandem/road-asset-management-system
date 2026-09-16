from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.security import AuthenticatedUser, EngineerUser
from app.db.session import get_db
from app.models.road import Road
from app.schemas.road import RoadCreate, RoadGeoJSONResponse, RoadResponse

router = APIRouter(prefix="/roads", tags=["Roads"])
DbSession = Annotated[Session, Depends(get_db)]


@router.get("", response_model=list[RoadResponse])
def list_roads(db: DbSession, current_user: AuthenticatedUser):
    return db.scalars(select(Road).order_by(Road.road_id)).all()


@router.get("/geojson", response_model=RoadGeoJSONResponse)
def road_geojson(db: DbSession, current_user: AuthenticatedUser):
    rows = db.execute(
        select(Road, func.ST_AsGeoJSON(Road.geometry).label("geometry_json"))
        .order_by(Road.road_id)
    ).all()

    features = []
    for road, geometry_json in rows:
        geometry = None
        if geometry_json:
            import json
            geometry = json.loads(geometry_json)

        features.append(
            {
                "type": "Feature",
                "geometry": geometry,
                "properties": {
                    "road_id": road.road_id,
                    "road_code": road.road_code,
                    "road_name": road.road_name,
                    "road_class": road.road_class,
                    "surface_type": road.surface_type,
                    "total_length_km": float(road.total_length_km) if road.total_length_km is not None else None,
                    "status": road.status,
                },
            }
        )

    return {"type": "FeatureCollection", "features": features}


@router.get("/{road_id}", response_model=RoadResponse)
def get_road(road_id: int, db: DbSession, current_user: AuthenticatedUser):
    road = db.get(Road, road_id)
    if road is None:
        raise HTTPException(status_code=404, detail="Road not found")
    return road


@router.post("", response_model=RoadResponse, status_code=201)
def create_road(payload: RoadCreate, db: DbSession, current_user: EngineerUser):
    road = Road(
        organization_id=payload.organization_id,
        road_code=payload.road_code,
        road_name=payload.road_name,
        road_class=payload.road_class,
        surface_type=payload.surface_type,
        start_location=payload.start_location,
        end_location=payload.end_location,
        total_length_km=payload.total_length_km,
        status=payload.status,
    )

    if payload.geometry_wkt:
        road.geometry = func.ST_GeomFromText(payload.geometry_wkt, 4326)

    db.add(road)
    db.commit()
    db.refresh(road)
    return road
