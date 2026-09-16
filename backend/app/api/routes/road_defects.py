from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.inspection import Inspection
from app.models.road_defect import RoadDefect
from app.models.road_section import RoadSection
from app.schemas.road_defect import RoadDefectCreate, RoadDefectResponse

router = APIRouter(tags=["Road Defects"])
DbSession = Annotated[Session, Depends(get_db)]


@router.get("/defects/geojson")
def defects_geojson(db: DbSession):
    rows = db.execute(
        select(
            RoadDefect.defect_id,
            RoadDefect.inspection_id,
            RoadDefect.section_id,
            RoadDefect.defect_type,
            RoadDefect.severity,
            RoadDefect.chainage_km,
            RoadDefect.detected_by,
            func.ST_AsGeoJSON(RoadDefect.geometry),
        )
        .where(RoadDefect.geometry.is_not(None))
        .order_by(RoadDefect.defect_id)
    ).all()

    import json

    return {
        "type": "FeatureCollection",
        "features": [
            {
                "type": "Feature",
                "geometry": json.loads(geometry_json),
                "properties": {
                    "defect_id": defect_id,
                    "inspection_id": inspection_id,
                    "section_id": section_id,
                    "defect_type": defect_type,
                    "severity": severity,
                    "chainage_km": float(chainage_km) if chainage_km is not None else None,
                    "detected_by": detected_by,
                },
            }
            for defect_id, inspection_id, section_id, defect_type, severity, chainage_km, detected_by, geometry_json in rows
        ],
    }


@router.get("/inspections/{inspection_id}/defects", response_model=list[RoadDefectResponse])
def list_defects(inspection_id: int, db: DbSession):
    if db.get(Inspection, inspection_id) is None:
        raise HTTPException(status_code=404, detail="Inspection not found")

    return db.scalars(
        select(RoadDefect)
        .where(RoadDefect.inspection_id == inspection_id)
        .order_by(RoadDefect.chainage_km, RoadDefect.defect_id)
    ).all()


@router.get("/defects/{defect_id}", response_model=RoadDefectResponse)
def get_defect(defect_id: int, db: DbSession):
    defect = db.get(RoadDefect, defect_id)
    if defect is None:
        raise HTTPException(status_code=404, detail="Road defect not found")
    return defect


@router.post(
    "/inspections/{inspection_id}/defects",
    response_model=RoadDefectResponse,
    status_code=201,
)
def create_defect(inspection_id: int, payload: RoadDefectCreate, db: DbSession):
    inspection = db.get(Inspection, inspection_id)
    if inspection is None:
        raise HTTPException(status_code=404, detail="Inspection not found")

    section_id = payload.section_id or inspection.section_id
    if section_id is not None:
        section = db.get(RoadSection, section_id)
        if section is None:
            raise HTTPException(status_code=400, detail="Road section not found")

        if payload.chainage_km is not None and not (
            float(section.start_chainage) <= payload.chainage_km <= float(section.end_chainage)
        ):
            raise HTTPException(status_code=400, detail="Defect chainage is outside the section range")

    geometry = None
    if payload.geometry_wkt:
        geometry = func.ST_GeomFromText(payload.geometry_wkt, 4326)

    defect = RoadDefect(
        inspection_id=inspection_id,
        section_id=section_id,
        defect_type=payload.defect_type,
        severity=payload.severity,
        chainage_km=payload.chainage_km,
        length_m=payload.length_m,
        width_m=payload.width_m,
        depth_mm=payload.depth_mm,
        description=payload.description,
        geometry=geometry,
        detected_by=payload.detected_by,
    )

    db.add(defect)
    try:
        db.commit()
    except Exception:
        db.rollback()
        raise HTTPException(status_code=400, detail="Could not create road defect")

    db.refresh(defect)
    return defect
