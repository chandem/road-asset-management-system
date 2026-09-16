from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.inspection import Inspection
from app.models.road_defect import RoadDefect
from app.schemas.road_defect import RoadDefectCreate, RoadDefectResponse

router = APIRouter(tags=["Road Defects"])
DbSession = Annotated[Session, Depends(get_db)]


@router.get("/inspections/{inspection_id}/defects", response_model=list[RoadDefectResponse])
def list_defects(inspection_id: int, db: DbSession):
    if db.get(Inspection, inspection_id) is None:
        raise HTTPException(status_code=404, detail="Inspection not found")

    return db.scalars(
        select(RoadDefect)
        .where(RoadDefect.inspection_id == inspection_id)
        .order_by(RoadDefect.chainage_start, RoadDefect.defect_id)
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
    if db.get(Inspection, inspection_id) is None:
        raise HTTPException(status_code=404, detail="Inspection not found")

    geometry = None
    if payload.geometry_wkt:
        geometry = func.ST_GeomFromText(payload.geometry_wkt, 4326)

    defect = RoadDefect(
        inspection_id=inspection_id,
        defect_type=payload.defect_type,
        severity=payload.severity,
        chainage_start=payload.chainage_start,
        chainage_end=payload.chainage_end,
        quantity=payload.quantity,
        unit=payload.unit,
        description=payload.description,
        geometry=geometry,
    )

    db.add(defect)
    try:
        db.commit()
    except Exception:
        db.rollback()
        raise HTTPException(status_code=400, detail="Could not create road defect")

    db.refresh(defect)
    return defect
