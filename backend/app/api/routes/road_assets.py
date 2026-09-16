from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.road import Road
from app.models.road_asset import RoadAsset
from app.models.road_section import RoadSection
from app.schemas.road_asset import RoadAssetCreate, RoadAssetResponse

router = APIRouter(tags=["Road Assets"])
DbSession = Annotated[Session, Depends(get_db)]


@router.get("/roads/{road_id}/assets", response_model=list[RoadAssetResponse])
def list_assets(road_id: int, db: DbSession):
    if db.get(Road, road_id) is None:
        raise HTTPException(status_code=404, detail="Road not found")

    return db.scalars(
        select(RoadAsset)
        .where(RoadAsset.road_id == road_id)
        .order_by(RoadAsset.chainage_km, RoadAsset.asset_id)
    ).all()


@router.get("/assets/{asset_id}", response_model=RoadAssetResponse)
def get_asset(asset_id: int, db: DbSession):
    asset = db.get(RoadAsset, asset_id)
    if asset is None:
        raise HTTPException(status_code=404, detail="Road asset not found")
    return asset


@router.post("/roads/{road_id}/assets", response_model=RoadAssetResponse, status_code=201)
def create_asset(road_id: int, payload: RoadAssetCreate, db: DbSession):
    if db.get(Road, road_id) is None:
        raise HTTPException(status_code=404, detail="Road not found")

    if payload.section_id is not None:
        section = db.get(RoadSection, payload.section_id)
        if section is None or section.road_id != road_id:
            raise HTTPException(status_code=400, detail="Section does not belong to this road")

        if payload.chainage_km is not None and not (
            float(section.start_chainage) <= payload.chainage_km <= float(section.end_chainage)
        ):
            raise HTTPException(status_code=400, detail="Asset chainage is outside the section range")

    geometry = None
    if payload.geometry_wkt:
        geometry = func.ST_GeomFromText(payload.geometry_wkt, 4326)

    asset = RoadAsset(
        road_id=road_id,
        section_id=payload.section_id,
        asset_type=payload.asset_type,
        asset_code=payload.asset_code,
        chainage_km=payload.chainage_km,
        description=payload.description,
        condition_rating=payload.condition_rating,
        geometry=geometry,
    )

    db.add(asset)
    try:
        db.commit()
    except Exception:
        db.rollback()
        raise HTTPException(status_code=400, detail="Could not create road asset")

    db.refresh(asset)
    return asset
