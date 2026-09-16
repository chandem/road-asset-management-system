from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.chainage_point import ChainagePoint
from app.models.road_section import RoadSection
from app.schemas.chainage_point import ChainagePointCreate, ChainagePointResponse

router = APIRouter(tags=["Chainage Points"])
DbSession = Annotated[Session, Depends(get_db)]


@router.get(
    "/sections/{section_id}/chainage-points",
    response_model=list[ChainagePointResponse],
)
def list_chainage_points(section_id: int, db: DbSession):
    if db.get(RoadSection, section_id) is None:
        raise HTTPException(status_code=404, detail="Road section not found")

    return db.scalars(
        select(ChainagePoint)
        .where(ChainagePoint.section_id == section_id)
        .order_by(ChainagePoint.chainage_km)
    ).all()


@router.get("/chainage-points/{point_id}", response_model=ChainagePointResponse)
def get_chainage_point(point_id: int, db: DbSession):
    point = db.get(ChainagePoint, point_id)
    if point is None:
        raise HTTPException(status_code=404, detail="Chainage point not found")
    return point


@router.post(
    "/sections/{section_id}/chainage-points",
    response_model=ChainagePointResponse,
    status_code=201,
)
def create_chainage_point(
    section_id: int,
    payload: ChainagePointCreate,
    db: DbSession,
):
    section = db.get(RoadSection, section_id)
    if section is None:
        raise HTTPException(status_code=404, detail="Road section not found")

    if payload.chainage_km < float(section.start_chainage) or payload.chainage_km > float(section.end_chainage):
        raise HTTPException(
            status_code=400,
            detail="chainage_km must be within the road section chainage range",
        )

    point = ChainagePoint(
        section_id=section_id,
        chainage_km=payload.chainage_km,
        latitude=payload.latitude,
        longitude=payload.longitude,
        elevation_m=payload.elevation_m,
        utm_zone=payload.utm_zone,
        utm_easting=payload.utm_easting,
        utm_northing=payload.utm_northing,
        geometry=func.ST_SetSRID(
            func.ST_MakePoint(payload.longitude, payload.latitude), 4326
        ),
    )

    db.add(point)
    try:
        db.commit()
    except Exception:
        db.rollback()
        raise HTTPException(status_code=400, detail="Could not create chainage point")

    db.refresh(point)
    return point
