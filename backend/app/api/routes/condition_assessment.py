from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import AuthenticatedUser
from app.db.session import get_db
from app.models.inspection import Inspection
from app.models.road_defect import RoadDefect
from app.models.road_section import RoadSection
from app.services.condition_engine import assess_condition

router = APIRouter(tags=["Condition Assessment"])
DbSession = Annotated[Session, Depends(get_db)]


def _latest_inspection(db: Session, section_id: int):
    return db.scalar(
        select(Inspection)
        .where(Inspection.section_id == section_id)
        .order_by(Inspection.inspection_date.desc(), Inspection.inspection_id.desc())
        .limit(1)
    )


def _defects(db: Session, section_id: int):
    rows = db.scalars(
        select(RoadDefect).where(RoadDefect.section_id == section_id)
    ).all()
    return [
        {
            "defect_type": defect.defect_type,
            "severity": defect.severity,
            "length_m": defect.length_m,
            "width_m": defect.width_m,
            "depth_mm": defect.depth_mm,
        }
        for defect in rows
    ]


@router.get("/sections/{section_id}/condition-assessment")
def section_condition_assessment(
    section_id: int,
    db: DbSession,
    current_user: AuthenticatedUser,
):
    section = db.get(RoadSection, section_id)
    if section is None:
        raise HTTPException(status_code=404, detail="Road section not found")

    inspection = _latest_inspection(db, section_id)
    defects = _defects(db, section_id)
    assessment = assess_condition(
        float(inspection.condition_rating) if inspection and inspection.condition_rating is not None else None,
        defects,
    )
    return {
        "section_id": section.section_id,
        "road_id": section.road_id,
        "section_code": section.section_code,
        "latest_inspection_id": inspection.inspection_id if inspection else None,
        "inspection_rating": float(inspection.condition_rating) if inspection and inspection.condition_rating is not None else None,
        "score": assessment.score,
        "category": assessment.category,
        "priority": assessment.priority,
        "recommendation": assessment.recommendation,
        "defect_impact": assessment.defect_impact,
        "defect_count": assessment.defect_count,
    }


@router.get("/roads/{road_id}/condition-assessment")
def road_condition_assessment(
    road_id: int,
    db: DbSession,
    current_user: AuthenticatedUser,
):
    sections = db.scalars(
        select(RoadSection)
        .where(RoadSection.road_id == road_id)
        .order_by(RoadSection.start_chainage, RoadSection.section_id)
    ).all()
    if not sections:
        raise HTTPException(status_code=404, detail="No road sections found")

    results = []
    for section in sections:
        inspection = _latest_inspection(db, section.section_id)
        defects = _defects(db, section.section_id)
        assessment = assess_condition(
            float(inspection.condition_rating) if inspection and inspection.condition_rating is not None else None,
            defects,
        )
        results.append({
            "section_id": section.section_id,
            "section_code": section.section_code,
            "start_chainage": float(section.start_chainage),
            "end_chainage": float(section.end_chainage),
            "score": assessment.score,
            "category": assessment.category,
            "priority": assessment.priority,
            "recommendation": assessment.recommendation,
            "defect_count": assessment.defect_count,
        })

    return {
        "road_id": road_id,
        "section_count": len(results),
        "average_score": round(sum(item["score"] for item in results) / len(results), 2),
        "items": results,
    }
