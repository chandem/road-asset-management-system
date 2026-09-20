from datetime import datetime
from pathlib import Path
from typing import Annotated

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.security import AuthenticatedUser, FieldStaffUser
from app.db.session import get_db
from app.models.image import Image
from app.models.inspection import Inspection
from app.models.road_defect import RoadDefect
from app.schemas.image import ImageResponse
from app.services.object_storage import StorageError, get_storage

router = APIRouter(tags=["Images"])
DbSession = Annotated[Session, Depends(get_db)]

ALLOWED_TYPES = {"image/jpeg", "image/png", "image/webp"}
MAX_FILE_SIZE = 10 * 1024 * 1024


@router.get("/storage/status")
def storage_status(current_user: AuthenticatedUser):
    """Ops helper: which photo backend is active."""
    return get_storage().status()


@router.get("/images", response_model=list[ImageResponse])
def list_images(db: DbSession, current_user: AuthenticatedUser):
    return db.scalars(select(Image).order_by(Image.image_id.desc())).all()


@router.get("/images/{image_id}", response_model=ImageResponse)
def get_image(image_id: int, db: DbSession, current_user: AuthenticatedUser):
    image = db.get(Image, image_id)
    if image is None:
        raise HTTPException(status_code=404, detail="Image not found")
    return image


@router.post("/images/upload", response_model=ImageResponse, status_code=201)
async def upload_image(
    db: DbSession,
    current_user: FieldStaffUser,
    file: UploadFile = File(...),
    inspection_id: int | None = Form(default=None),
    defect_id: int | None = Form(default=None),
    captured_at: str | None = Form(default=None),
    latitude: float | None = Form(default=None),
    longitude: float | None = Form(default=None),
):
    if file.content_type not in ALLOWED_TYPES:
        raise HTTPException(
            status_code=400, detail="Only JPEG, PNG and WebP images are allowed"
        )

    if inspection_id is not None and db.get(Inspection, inspection_id) is None:
        raise HTTPException(status_code=400, detail="Inspection not found")

    if defect_id is not None and db.get(RoadDefect, defect_id) is None:
        raise HTTPException(status_code=400, detail="Defect not found")

    if latitude is not None and longitude is not None:
        if not (-90 <= latitude <= 90 and -180 <= longitude <= 180):
            raise HTTPException(status_code=400, detail="Invalid GPS coordinates")
    elif latitude is not None or longitude is not None:
        raise HTTPException(
            status_code=400,
            detail="Latitude and longitude must be provided together",
        )

    captured_at_value = None
    if captured_at:
        try:
            captured_at_value = datetime.fromisoformat(captured_at.replace("Z", "+00:00"))
        except ValueError as exc:
            raise HTTPException(
                status_code=400,
                detail="captured_at must be a valid ISO 8601 timestamp",
            ) from exc

    data = await file.read()
    if len(data) > MAX_FILE_SIZE:
        raise HTTPException(status_code=413, detail="Image must be 10 MB or smaller")

    storage = get_storage()
    try:
        stored_ref = storage.store(
            data,
            original_name=file.filename or "image.jpg",
            content_type=file.content_type or "image/jpeg",
        )
    except StorageError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc

    geometry = None
    if latitude is not None and longitude is not None:
        geometry = func.ST_SetSRID(func.ST_MakePoint(longitude, latitude), 4326)

    image = Image(
        inspection_id=inspection_id,
        defect_id=defect_id,
        file_name=file.filename or Path(stored_ref).name,
        file_path=stored_ref,
        captured_at=captured_at_value,
        latitude=latitude,
        longitude=longitude,
        geometry=geometry,
    )

    db.add(image)
    try:
        db.commit()
    except Exception:
        db.rollback()
        storage.delete(stored_ref)
        raise HTTPException(status_code=400, detail="Could not create image record")

    db.refresh(image)
    return image
