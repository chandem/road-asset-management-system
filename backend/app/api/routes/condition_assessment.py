from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import AuthenticatedUser, EngineerUser
from app.db.session import get_db
from app.models.inspection import Inspection
from app.models.maintenance_activity import MaintenanceActivity
from app.models.road_defect import RoadDefect
from app.models.road_section import RoadSection
from app.schemas.maintenance_activity import MaintenanceActivityResponse
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


def _defect_rows(db: Session, section_id: int):
    return db.scalars(
        select(RoadDefect)
        .where(RoadDefect.section_id == section_id)
        .order_by(RoadDefect.defect_id)
    ).all()


def _defects(db: Session, section_id: int):
    rows = _defect_rows(db, section_id)
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


def _assessment_for_section(db: Session, section_id: int):
    inspection = _latest_inspection(db, section_id)
    defects = _defects(db, section_id)
    assessment = assess_condition(
        float(inspection.condition_rating) if inspection and inspection.condition_rating is not None else None,
        defects,
    )
    return inspection, defects, assessment


@router.get("/sections/{section_id}/condition-assessment")
def section_condition_assessment(
    section_id: int,
    db: DbSession,
    current_user: AuthenticatedUser,
):
    section = db.get(RoadSection, section_id)
    if section is None:
        raise HTTPException(status_code=404, detail="Road section not found")

    inspection, defects, assessment = _assessment_for_section(db, section_id)
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


@router.post(
    "/sections/{section_id}/condition-assessment/maintenance",
    response_model=MaintenanceActivityResponse,
    status_code=201,
)
def create_maintenance_from_condition_assessment(
    section_id: int,
    db: DbSession,
    current_user: EngineerUser,
):
    section = db.get(RoadSection, section_id)
    if section is None:
        raise HTTPException(status_code=404, detail="Road section not found")

    inspection, _, assessment = _assessment_for_section(db, section_id)

    existing = db.scalar(
        select(MaintenanceActivity)
        .where(
            MaintenanceActivity.road_id == section.road_id,
            MaintenanceActivity.section_id == section.section_id,
            MaintenanceActivity.status.in_(["planned", "in progress"]),
            MaintenanceActivity.description.ilike("%Generated from condition assessment%"),
        )
        .order_by(MaintenanceActivity.maintenance_id.desc())
        .limit(1)
    )
    if existing is not None:
        return existing

    defect_rows = _defect_rows(db, section_id)
    severity_rank = {"critical": 0, "high": 1, "medium": 2, "low": 3}
    source_defect = min(
        defect_rows,
        key=lambda defect: severity_rank.get(str(defect.severity or "low").strip().lower(), 3),
        default=None,
    )

    activity_type = {
        "critical": "Emergency repair / rehabilitation",
        "high": "Major maintenance / rehabilitation",
        "medium": "Preventive maintenance",
        "low": "Routine maintenance / monitoring",
    }[assessment.priority]

    description = (
        "Generated from condition assessment. "
        f"Score={assessment.score}, category={assessment.category}, "
        f"defects={assessment.defect_count}. {assessment.recommendation}"
    )

    activity = MaintenanceActivity(
        road_id=section.road_id,
        section_id=section.section_id,
        source_defect_id=source_defect.defect_id if source_defect else None,
        activity_type=activity_type,
        priority=assessment.priority,
        estimated_cost=None,
        actual_cost=None,
        status="planned",
        description=description,
    )

    db.add(activity)
    try:
        db.commit()
    except Exception:
        db.rollback()
        raise HTTPException(status_code=400, detail="Could not create maintenance recommendation")

    db.refresh(activity)
    return activity


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
        inspection, _, assessment = _assessment_for_section(db, section.section_id)
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
