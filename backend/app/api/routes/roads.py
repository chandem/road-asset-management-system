from typing import Annotated, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, or_, select, text
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
    text_wkt = geometry_wkt.strip()
    if not text_wkt:
        road.geometry = None
        return
    road.geometry = func.ST_GeomFromText(text_wkt, 4326)


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
    except Exception as exc:
        db.rollback()
        raise HTTPException(status_code=400, detail=f"Could not create road: {exc}") from exc
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
    except Exception as exc:
        db.rollback()
        raise HTTPException(status_code=400, detail=f"Could not update road: {exc}") from exc
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
    """Split a road into fixed-length sections (default 500 m)."""
    road = db.get(Road, road_id)
    if road is None:
        raise HTTPException(status_code=404, detail="Road not found")

    existing_count = db.scalar(
        select(func.count()).select_from(RoadSection).where(RoadSection.road_id == road_id)
    ) or 0
    if existing_count and not payload.replace_existing:
        raise HTTPException(
            status_code=409,
            detail=(
                f"Road already has {existing_count} section(s). "
                "Use Regenerate (replace) or set replace_existing=true."
            ),
        )

    length_km = None
    if road.total_length_km is not None:
        try:
            length_km = float(road.total_length_km)
        except (TypeError, ValueError):
            length_km = None

    if length_km is None or length_km <= 0:
        try:
            length_m = db.execute(
                text(
                    "SELECT ST_Length(geometry::geography) "
                    "FROM rams.roads "
                    "WHERE road_id = :rid AND geometry IS NOT NULL"
                ),
                {"rid": road_id},
            ).scalar()
            if length_m is not None and float(length_m) > 0:
                length_km = float(length_m) / 1000.0
        except Exception:
            length_km = None

    if length_km is None or length_km <= 0:
        raise HTTPException(
            status_code=400,
            detail=(
                "Cannot generate sections: set Length (km) on the road "
                "(e.g. 2.5) or provide a valid LINESTRING geometry."
            ),
        )

    if payload.replace_existing and existing_count:
        db.execute(
            text("DELETE FROM rams.road_sections WHERE road_id = :rid"),
            {"rid": road_id},
        )
        db.flush()

    has_geometry = bool(
        db.execute(
            text(
                "SELECT geometry IS NOT NULL FROM rams.roads WHERE road_id = :rid"
            ),
            {"rid": road_id},
        ).scalar()
    )

    section_km = float(payload.section_length_m) / 1000.0
    if section_km <= 0:
        raise HTTPException(status_code=400, detail="section_length_m must be > 0")

    created = 0
    start = 0.0
    index = 1
    surface = road.surface_type

    try:
        while start < length_km - 1e-9:
            end = min(start + section_km, length_km)
            code = f"{road.road_code}-S{index:03d}"
            # ensure unique section_code
            while db.execute(
                text(
                    "SELECT 1 FROM rams.road_sections WHERE section_code = :code LIMIT 1"
                ),
                {"code": code},
            ).first():
                index += 1
                code = f"{road.road_code}-S{index:03d}"

            if has_geometry:
                f0 = max(0.0, min(1.0, start / length_km))
                f1 = max(0.0, min(1.0, end / length_km))
                if f1 <= f0:
                    f1 = min(1.0, f0 + 1e-6)
                db.execute(
                    text(
                        """
                        INSERT INTO rams.road_sections (
                            road_id, section_code, start_chainage, end_chainage,
                            length_km, surface_type, geometry
                        )
                        SELECT
                            :rid,
                            :code,
                            :start_ch,
                            :end_ch,
                            :len_km,
                            :surface,
                            ST_LineSubstring(geometry, :f0, :f1)
                        FROM rams.roads
                        WHERE road_id = :rid
                        """
                    ),
                    {
                        "rid": road_id,
                        "code": code,
                        "start_ch": round(start, 3),
                        "end_ch": round(end, 3),
                        "len_km": round(end - start, 3),
                        "surface": surface,
                        "f0": f0,
                        "f1": f1,
                    },
                )
            else:
                db.execute(
                    text(
                        """
                        INSERT INTO rams.road_sections (
                            road_id, section_code, start_chainage, end_chainage,
                            length_km, surface_type
                        ) VALUES (
                            :rid, :code, :start_ch, :end_ch, :len_km, :surface
                        )
                        """
                    ),
                    {
                        "rid": road_id,
                        "code": code,
                        "start_ch": round(start, 3),
                        "end_ch": round(end, 3),
                        "len_km": round(end - start, 3),
                        "surface": surface,
                    },
                )

            created += 1
            index += 1
            start = end

        if road.total_length_km is None:
            road.total_length_km = round(length_km, 3)

        db.commit()
    except Exception as exc:
        db.rollback()
        raise HTTPException(
            status_code=400,
            detail=f"Could not generate sections: {exc}",
        ) from exc

    return GenerateSectionsResponse(
        road_id=road_id,
        sections_created=created,
        section_length_m=float(payload.section_length_m),
        total_length_km=round(length_km, 3),
    )
