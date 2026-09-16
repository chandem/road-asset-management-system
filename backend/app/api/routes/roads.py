from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.road import Road
from app.schemas.road import RoadCreate, RoadResponse

router = APIRouter(prefix="/roads", tags=["Roads"])
DbSession = Annotated[Session, Depends(get_db)]


@router.get("", response_model=list[RoadResponse])
def list_roads(db: DbSession):
    return db.scalars(select(Road).order_by(Road.road_id)).all()


@router.get("/{road_id}", response_model=RoadResponse)
def get_road(road_id: int, db: DbSession):
    road = db.get(Road, road_id)
    if road is None:
        raise HTTPException(status_code=404, detail="Road not found")
    return road


@router.post("", response_model=RoadResponse, status_code=201)
def create_road(payload: RoadCreate, db: DbSession):
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

    db.add(road)
    db.commit()
    db.refresh(road)
    return road
