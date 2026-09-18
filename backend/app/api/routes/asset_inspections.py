from typing import Annotated
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.core.security import AuthenticatedUser, FieldStaffUser
from app.db.session import get_db
from app.models.asset_inspection import AssetInspection
from app.models.road_asset import RoadAsset
from app.schemas.asset_inspection import AssetInspectionCreate, AssetInspectionResponse

router = APIRouter(tags=["Asset Lifecycle"])
DbSession = Annotated[Session, Depends(get_db)]

@router.get("/assets/{asset_id}/inspections", response_model=list[AssetInspectionResponse])
def list_asset_inspections(asset_id: int, db: DbSession, current_user: AuthenticatedUser):
    if db.get(RoadAsset, asset_id) is None: raise HTTPException(status_code=404, detail="Road asset not found")
    return db.scalars(select(AssetInspection).where(AssetInspection.asset_id == asset_id).order_by(AssetInspection.inspection_date.desc(), AssetInspection.asset_inspection_id.desc())).all()

@router.post("/assets/{asset_id}/inspections", response_model=AssetInspectionResponse, status_code=201)
def create_asset_inspection(asset_id: int, payload: AssetInspectionCreate, db: DbSession, current_user: FieldStaffUser):
    asset = db.get(RoadAsset, asset_id)
    if asset is None: raise HTTPException(status_code=404, detail="Road asset not found")
    inspection = AssetInspection(asset_id=asset_id, **payload.model_dump())
    db.add(inspection)
    if payload.condition_rating is not None: asset.condition_rating = payload.condition_rating
    try: db.commit()
    except Exception:
        db.rollback(); raise HTTPException(status_code=400, detail="Could not create asset inspection")
    db.refresh(inspection); return inspection
