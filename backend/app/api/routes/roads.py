from typing import Annotated, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.core.security import AuthenticatedUser, EngineerUser
from app.db.session import get_db
from app.models.road import Road
from app.models.road_section import RoadSection
from app.schemas.road import (
    GenerateSectionsRequest,
    GenerateSectionsResponse,
    RoadCreate,
    RoadGeoJSONResponse,
    RoadResponse,
    RoadUpdate,
)

router = APIRouter(prefix="/roads", tags=["Roads"])
DbSession = Annotated[Session, Depends(get_db)]


def _apply_geometry(road: Road, geometry_wkt: Optional[str]) -> None:
    if geometry_wkt is None:
        return
    text = geometry_wkt.strip()
    if not text:
        road.geometry = None
        return
    road.geometry = func.ST_GeomFromText(text, 4326)


@router.get("", response_model=list[RoadResponse])
def list_roads(
    db: DbSession,
    current_user: AuthenticatedUser,
    q: Optional[str] = Query(default=None, description="Search code, name, locations"),
    status: Optional[str] = Query(default=None),
    road_class: Optional[str] = Query(default=None, alias="class"),
):
    stmt = select(Road)
    if q:
        term = f"%{q.strip()}%"
        stmt = stmt.where(
            or_(
                Road.road_code.ilike(term),
                Road.road_name.ilike(term),
                Road.start_location.ilike(term),
                Road.end_location.ilike(term),
            )
        )
    if status:
        stmt = stmt.where(Road.status == status)
    if road_class:
        stmt = stmt.where(Road.road_class == road_class)
    return db.scalars(stmt.order_by(Road.road_id)).all()


@router.get("/geojson", response_model=RoadGeoJSONResponse)
def road_geojson(
    db: DbSession,
    current_user: AuthenticatedUser,
    status: Optional[str] = Query(default="active"),
):
    stmt = select(Road, func.ST_AsGeoJSON(Road.geometry).label("geometry_json")).order_by(
        Road.road_id
    )
    if status:
        stmt = stmt.where(Road.status == status)

    rows = db.execute(stmt).all()
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
                    "total_length_km": float(road.total_length_km)
                    if road.total_length_km is not None
                    else None,
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
    existing = db.scalar(select(Road).where(Road.road_code == payload.road_code))
    if existing is not None:
        raise HTTPException(status_code=409, detail="road_code already exists")

    road = Road(
        organization_id=payload.organization_id,
        road_code=payload.road_code,
        road_name=payload.road_name,
        road_class=payload.road_class,
        surface_type=payload.surface_type,
        start_location=payload.start_location,
        end_location=payload.end_location,
        total_length_km=payload.total_length_km,
        status=payload.status or "active",
    )
    _apply_geometry(road, payload.geometry_wkt)

    db.add(road)
    try:
        db.commit()
    except Exception:
        db.rollback()
        raise HTTPException(status_code=400, detail="Could not create road")
    db.refresh(road)
    return road


@router.patch("/{road_id}", response_model=RoadResponse)
def update_road(
    road_id: int,
    payload: RoadUpdate,
    db: DbSession,
    current_user: EngineerUser,
):
    road = db.get(Road, road_id)
    if road is None:
        raise HTTPException(status_code=404, detail="Road not found")

    data = payload.model_dump(exclude_unset=True)
    geometry_wkt = data.pop("geometry_wkt", None)

    if "road_code" in data and data["road_code"] != road.road_code:
        clash = db.scalar(
            select(Road).where(
                Road.road_code == data["road_code"], Road.road_id != road_id
            )
        )
        if clash is not None:
            raise HTTPException(status_code=409, detail="road_code already exists")

    for key, value in data.items():
        setattr(road, key, value)

    if "geometry_wkt" in payload.model_fields_set:
        _apply_geometry(road, geometry_wkt)

    try:
        db.commit()
    except Exception:
        db.rollback()
        raise HTTPException(status_code=400, detail="Could not update road")
    db.refresh(road)
    return road


@router.delete("/{road_id}", response_model=RoadResponse)
def archive_road(road_id: int, db: DbSession, current_user: EngineerUser):
    """Soft-delete: set status to archived (keeps history and sections)."""
    road = db.get(Road, road_id)
    if road is None:
        raise HTTPException(status_code=404, detail="Road not found")
    road.status = "archived"
    db.commit()
    db.refresh(road)
    return road


@router.post(
    "/{road_id}/generate-sections",
    response_model=GenerateSectionsResponse,
)
def generate_sections(
    road_id: int,
    payload: GenerateSectionsRequest,
    db: DbSession,
    current_user: EngineerUser,
):
    """Split a road into fixed-length sections (default 500 m).

    Uses total_length_km when set; otherwise derives length from PostGIS geometry.
    When geometry exists, each section gets a LINESTRING substring.
    """
    road = db.get(Road, road_id)
    if road is None:
        raise HTTPException(status_code=404, detail="Road not found")

    existing = db.scalars(
        select(RoadSection).where(RoadSection.road_id == road_id)
    ).all()
    if existing and not payload.replace_existing:
        raise HTTPException(
            status_code=409,
            detail="Road already has sections. Pass replace_existing=true to regenerate.",
        )

    length_km = float(road.total_length_km) if road.total_length_km is not None else None
    if length_km is None or length_km <= 0:
        geom_len_m = db.scalar(
            select(
                func.ST_Length(func.Geography(func.ST_Transform(Road.geometry, 4326)))
            ).where(Road.road_id == road_id)
        )
        # ST_Length on geography returns meters; simpler path:
        geom_len_m = db.scalar(
            select(func.ST_Length(Road.geometry.cast(type_=None))).where(
                Road.road_id == road_id
            )
        )
        # Prefer geography length in meters
        geom_len_m = db.execute(
            select(
                func.ST_Length(func.ST_Transform(Road.geometry, 4326), True)
            ).where(Road.road_id == road_id)
        ).scalar()
        if geom_len_m is None or float(geom_len_m) <= 0:
            # Try geography cast style used by PostGIS
            geom_len_m = db.execute(
                select(
                    func.ST_Length(
                        func.CAST(Road.geometry, type_=None)
                    )
                ).where(Road.road_id == road_id)
            ).scalar()

        length_m_row = db.execute(
            select(
                func.ST_Length(
                    func.Geography(
                        func.ST_SetSRID(Road.geometry, 4326)
                    )
                )
            ).where(Road.road_id == road_id)
        ).scalar()
        if length_m_row is not None and float(length_m_row) > 0:
            length_km = float(length_m_row) / 1000.0

    if length_km is None or length_km <= 0:
        raise HTTPException(
            status_code=400,
            detail="Set total_length_km or provide road geometry before generating sections",
        )

    if payload.replace_existing and existing:
        for sec in existing:
            db.delete(sec)
        db.flush()

    section_km = float(payload.section_length_m) / 1000.0
    created = 0
    start = 0.0
    index = 1
    has_geometry = (
        db.scalar(
            select(func.ST_AsText(Road.geometry)).where(Road.road_id == road_id)
        )
        is not None
    )

    while start < length_km - 1e-9:
        end = min(start + section_km, length_km)
        code = f"{road.road_code}-S{index:03d}"
        # avoid unique clashes if regenerating partial
        while db.scalar(select(RoadSection).where(RoadSection.section_code == code)):
            index += 1
            code = f"{road.road_code}-S{index:03d}"

        geometry = None
        if has_geometry and length_km > 0:
            # fraction along linestring 0..1
            f0 = start / length_km
            f1 = end / length_km
            geometry = func.ST_LineSubstring(Road.geometry, f0, f1)
            # bind via subquery from this road
            geometry = db.scalar(
                select(func.ST_LineSubstring(Road.geometry, f0, f1)).where(
                    Road.road_id == road_id
                )
            )

        section = RoadSection(
            road_id=road_id,
            section_code=code,
            start_chainage=round(start, 3),
            end_chainage=round(end, 3),
            length_km=round(end - start, 3),
            surface_type=road.surface_type,
            geometry=geometry,
        )
        db.add(section)
        created += 1
        index += 1
        start = end

    # persist length if it was derived
    if road.total_length_km is None:
        road.total_length_km = round(length_km, 3)

    try:
        db.commit()
    except Exception:
        db.rollback()
        raise HTTPException(status_code=400, detail="Could not generate sections")

    return GenerateSectionsResponse(
        road_id=road_id,
        sections_created=created,
        section_length_m=payload.section_length_m,
        total_length_km=round(length_km, 3),
    )
