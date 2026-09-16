from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.image import Image
from app.models.inspection import Inspection
from app.models.road_defect import RoadDefect
from app.schemas.image import ImageCreate, ImageResponse

router = APIRouter(tags=["Images"])
DbSession = Annotated[Session, Depends(get_db)]


@router.get("/images", response_model=list[ImageResponse])
def list_images(db: DbSession):
    return db.scalars(select(Image).order_by(Image.image_id.desc())).all()


@router.get("/images/{image_id}", response_model=ImageResponse)
def get_image(image_id: int, db: DbSession):
    image = db.get(Image, image_id)
    if image is None:
        raise HTTPException(status_code=404, detail="Image not found")
    return image


@router.post("/images", response_model=ImageResponse, status_code=201)
def create_image(payload: ImageCreate, db: DbSession):
    if payload.inspection_id is not None and db.get(Inspection, payload.inspection_id) is None:
        raise HTTPException(status_code=400, detail="Inspection not found")

    if payload.defect_id is not None and db.get(RoadDefect, payload.defect_id) is None:
        raise HTTPException(status_code=400, detail="Defect not found")

    geometry = None
    if payload.latitude is not None and payload.longitude is not None:
        geometry = func.ST_SetSRID(
            func.ST_MakePoint(payload.longitude, payload.latitude), 4326
        )

    image = Image(
        inspection_id=payload.inspection_id,
        defect_id=payload.defect_id,
        file_name=payload.file_name,
        file_path=payload.file_path,
        captured_at=payload.captured_at,
        latitude=payload.latitude,
        longitude=payload.longitude,
        geometry=geometry,
    )

    db.add(image)
    try:
        db.commit()
    except Exception:
        db.rollback()
        raise HTTPException(status_code=400, detail="Could not create image record")

    db.refresh(image)
    return image
