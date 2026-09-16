from pathlib import Path
from typing import Annotated
from uuid import uuid4

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.security import AuthenticatedUser, FieldStaffUser
from app.db.session import get_db
from app.models.image import Image
from app.models.inspection import Inspection
from app.models.road_defect import RoadDefect
from app.schemas.image import ImageResponse

router = APIRouter(tags=["Images"])
DbSession = Annotated[Session, Depends(get_db)]

UPLOAD_DIR = Path("uploads/images")
ALLOWED_TYPES = {"image/jpeg", "image/png", "image/webp"}
MAX_FILE_SIZE = 10 * 1024 * 1024


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
        raise HTTPException(status_code=400, detail="Only JPEG, PNG and WebP images are allowed")

    if inspection_id is not None and db.get(Inspection, inspection_id) is None:
        raise HTTPException(status_code=400, detail="Inspection not found")

    if defect_id is not None and db.get(RoadDefect, defect_id) is None:
        raise HTTPException(status_code=400, detail="Defect not found")

    data = await file.read()
    if len(data) > MAX_FILE_SIZE:
        raise HTTPException(status_code=413, detail="Image must be 10 MB or smaller")

    suffix = Path(file.filename or "image.jpg").suffix.lower() or ".jpg"
    stored_name = f"{uuid4().hex}{suffix}"
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    file_path = UPLOAD_DIR / stored_name
    file_path.write_bytes(data)

    geometry = None
    if latitude is not None and longitude is not None:
        if not (-90 <= latitude <= 90 and -180 <= longitude <= 180):
            raise HTTPException(status_code=400, detail="Invalid GPS coordinates")
        geometry = func.ST_SetSRID(func.ST_MakePoint(longitude, latitude), 4326)

    image = Image(
        inspection_id=inspection_id,
        defect_id=defect_id,
        file_name=file.filename or stored_name,
        file_path=str(file_path),
        captured_at=captured_at,
        latitude=latitude,
        longitude=longitude,
        geometry=geometry,
    )

    db.add(image)
    try:
        db.commit()
    except Exception:
        db.rollback()
        file_path.unlink(missing_ok=True)
        raise HTTPException(status_code=400, detail="Could not create image record")

    db.refresh(image)
    return image
