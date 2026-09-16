from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import AuthenticatedUser
from app.db.session import get_db
from app.models.ai_detection_result import AIDetectionResult
from app.models.image import Image
from app.models.inspection import Inspection
from app.models.road_defect import RoadDefect

router = APIRouter(tags=["Inspection Workflow"])
DbSession = Annotated[Session, Depends(get_db)]


@router.get("/inspections/{inspection_id}/workflow")
def get_inspection_workflow(
    inspection_id: int,
    db: DbSession,
    current_user: AuthenticatedUser,
):
    """Return the complete inspection -> defect -> photo -> AI workflow view."""
    inspection = db.get(Inspection, inspection_id)
    if inspection is None:
        raise HTTPException(status_code=404, detail="Inspection not found")

    defects = db.scalars(
        select(RoadDefect)
        .where(RoadDefect.inspection_id == inspection_id)
        .order_by(RoadDefect.defect_id)
    ).all()

    images = db.scalars(
        select(Image)
        .where(Image.inspection_id == inspection_id)
        .order_by(Image.image_id)
    ).all()

    image_ids = [image.image_id for image in images]
    detections = []
    if image_ids:
        detections = db.scalars(
            select(AIDetectionResult)
            .where(AIDetectionResult.image_id.in_(image_ids))
            .order_by(AIDetectionResult.detection_id)
        ).all()

    return {
        "inspection": {
            "inspection_id": inspection.inspection_id,
            "section_id": inspection.section_id,
            "inspector_id": inspection.inspector_id,
            "inspection_date": inspection.inspection_date,
            "condition_rating": inspection.condition_rating,
            "weather": inspection.weather,
            "notes": inspection.notes,
        },
        "summary": {
            "defect_count": len(defects),
            "image_count": len(images),
            "ai_detection_count": len(detections),
        },
        "defects": [
            {
                "defect_id": defect.defect_id,
                "section_id": defect.section_id,
                "defect_type": defect.defect_type,
                "severity": defect.severity,
                "chainage_km": defect.chainage_km,
                "length_m": defect.length_m,
                "width_m": defect.width_m,
                "depth_mm": defect.depth_mm,
                "description": defect.description,
                "detected_by": defect.detected_by,
            }
            for defect in defects
        ],
        "images": [
            {
                "image_id": image.image_id,
                "defect_id": image.defect_id,
                "file_name": image.file_name,
                "captured_at": image.captured_at,
                "latitude": image.latitude,
                "longitude": image.longitude,
            }
            for image in images
        ],
        "ai_detections": [
            {
                "detection_id": detection.detection_id,
                "image_id": detection.image_id,
                "model_name": detection.model_name,
                "model_version": detection.model_version,
                "defect_type": detection.defect_type,
                "confidence": detection.confidence,
                "bounding_box": detection.bounding_box,
                "detected_at": detection.detected_at,
            }
            for detection in detections
        ],
    }
