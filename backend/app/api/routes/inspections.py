from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.inspection import Inspection
from app.models.road import Road
from app.models.road_section import RoadSection
from app.schemas.inspection import InspectionCreate, InspectionResponse

router = APIRouter(tags=["Inspections"])
DbSession = Annotated[Session, Depends(get_db)]


@router.get("/roads/{road_id}/inspections", response_model=list[InspectionResponse])
def list_inspections(road_id: int, db: DbSession):
    if db.get(Road, road_id) is None:
        raise HTTPException(status_code=404, detail="Road not found")

    return db.scalars(
        select(Inspection)
        .where(Inspection.road_id == road_id)
        .order_by(Inspection.inspection_date.desc(), Inspection.inspection_id.desc())
    ).all()


@router.get("/inspections/{inspection_id}", response_model=InspectionResponse)
def get_inspection(inspection_id: int, db: DbSession):
    inspection = db.get(Inspection, inspection_id)
    if inspection is None:
        raise HTTPException(status_code=404, detail="Inspection not found")
    return inspection


@router.post("/roads/{road_id}/inspections", response_model=InspectionResponse, status_code=201)
def create_inspection(road_id: int, payload: InspectionCreate, db: DbSession):
    if db.get(Road, road_id) is None:
        raise HTTPException(status_code=404, detail="Road not found")

    if payload.section_id is not None:
        section = db.get(RoadSection, payload.section_id)
        if section is None or section.road_id != road_id:
            raise HTTPException(status_code=400, detail="Section does not belong to this road")

    inspection = Inspection(
        road_id=road_id,
        section_id=payload.section_id,
        inspection_date=payload.inspection_date,
        inspector_id=payload.inspector_id,
        overall_condition=payload.overall_condition,
        notes=payload.notes,
    )

    db.add(inspection)
    try:
        db.commit()
    except Exception:
        db.rollback()
        raise HTTPException(status_code=400, detail="Could not create inspection")

    db.refresh(inspection)
    return inspection
