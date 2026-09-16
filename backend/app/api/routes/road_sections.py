from typing import Annotated
import json

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.road import Road
from app.models.road_section import RoadSection
from app.schemas.road_section import RoadSectionCreate, RoadSectionResponse

router = APIRouter(tags=["Road Sections"])
DbSession = Annotated[Session, Depends(get_db)]


@router.get("/roads/{road_id}/sections", response_model=list[RoadSectionResponse])
def list_sections(road_id: int, db: DbSession):
    if db.get(Road, road_id) is None:
        raise HTTPException(status_code=404, detail="Road not found")

    return db.scalars(
        select(RoadSection)
        .where(RoadSection.road_id == road_id)
        .order_by(RoadSection.start_chainage)
    ).all()


@router.get("/roads/{road_id}/sections/geojson")
def sections_geojson(road_id: int, db: DbSession):
    if db.get(Road, road_id) is None:
        raise HTTPException(status_code=404, detail="Road not found")

    rows = db.execute(
        select(
            RoadSection.section_id,
            RoadSection.section_code,
            RoadSection.start_chainage,
            RoadSection.end_chainage,
            RoadSection.length_km,
            RoadSection.surface_type,
            RoadSection.condition_rating,
            func.ST_AsGeoJSON(RoadSection.geometry),
        )
        .where(RoadSection.road_id == road_id)
        .order_by(RoadSection.start_chainage)
    ).all()

    features = []
    for row in rows:
        geometry = json.loads(row[7]) if row[7] else None
        features.append({
            "type": "Feature",
            "geometry": geometry,
            "properties": {
                "section_id": row[0],
                "section_code": row[1],
                "start_chainage": float(row[2]),
                "end_chainage": float(row[3]),
                "length_km": float(row[4]) if row[4] is not None else None,
                "surface_type": row[5],
                "condition_rating": float(row[6]) if row[6] is not None else None,
            },
        })

    return {"type": "FeatureCollection", "features": features}


@router.get("/sections/{section_id}", response_model=RoadSectionResponse)
def get_section(section_id: int, db: DbSession):
    section = db.get(RoadSection, section_id)
    if section is None:
        raise HTTPException(status_code=404, detail="Road section not found")
    return section


@router.post(
    "/roads/{road_id}/sections",
    response_model=RoadSectionResponse,
    status_code=201,
)
def create_section(
    road_id: int,
    payload: RoadSectionCreate,
    db: DbSession,
):
    if db.get(Road, road_id) is None:
        raise HTTPException(status_code=404, detail="Road not found")

    if payload.geometry_wkt:
        geometry = func.ST_GeomFromText(payload.geometry_wkt, 4326)
    else:
        geometry = None

    section = RoadSection(
        road_id=road_id,
        section_code=payload.section_code,
        start_chainage=payload.start_chainage,
        end_chainage=payload.end_chainage,
        length_km=payload.length_km,
        surface_type=payload.surface_type,
        condition_rating=payload.condition_rating,
        geometry=geometry,
    )

    db.add(section)
    try:
        db.commit()
    except Exception:
        db.rollback()
        raise HTTPException(status_code=400, detail="Could not create road section")

    db.refresh(section)
    return section
