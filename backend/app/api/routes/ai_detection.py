from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.ai_detection_result import AIDetectionResult
from app.models.image import Image
from app.schemas.ai_detection_result import (
    AIDetectionResultCreate,
    AIDetectionResultResponse,
)

router = APIRouter(tags=["AI Detection"])
DbSession = Annotated[Session, Depends(get_db)]


@router.get(
    "/images/{image_id}/ai-detections",
    response_model=list[AIDetectionResultResponse],
)
def list_ai_detections(image_id: int, db: DbSession):
    if db.get(Image, image_id) is None:
        raise HTTPException(status_code=404, detail="Image not found")

    return db.scalars(
        select(AIDetectionResult)
        .where(AIDetectionResult.image_id == image_id)
        .order_by(AIDetectionResult.detection_id)
    ).all()


@router.get("/ai-detections/{detection_id}", response_model=AIDetectionResultResponse)
def get_ai_detection(detection_id: int, db: DbSession):
    detection = db.get(AIDetectionResult, detection_id)
    if detection is None:
        raise HTTPException(status_code=404, detail="AI detection result not found")
    return detection


@router.post(
    "/images/{image_id}/ai-detections",
    response_model=AIDetectionResultResponse,
    status_code=201,
)
def create_ai_detection(
    image_id: int,
    payload: AIDetectionResultCreate,
    db: DbSession,
):
    if db.get(Image, image_id) is None:
        raise HTTPException(status_code=404, detail="Image not found")

    detection = AIDetectionResult(
        image_id=image_id,
        model_name=payload.model_name,
        model_version=payload.model_version,
        defect_type=payload.defect_type,
        confidence=payload.confidence,
        bounding_box=payload.bounding_box,
    )

    db.add(detection)
    try:
        db.commit()
    except Exception:
        db.rollback()
        raise HTTPException(status_code=400, detail="Could not create AI detection result")

    db.refresh(detection)
    return detection
