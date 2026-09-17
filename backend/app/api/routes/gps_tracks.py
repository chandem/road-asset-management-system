from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.security import AuthenticatedUser, FieldStaffUser
from app.db.session import get_db
from app.models.gps_track import GPSTrack
from app.models.road import Road
from app.models.road_section import RoadSection
from app.schemas.gps_track import GPSTrackCreate, GPSTrackResponse

router = APIRouter(tags=["GPS Tracks"])
DbSession = Annotated[Session, Depends(get_db)]


@router.get("/gps-tracks/geojson")
def gps_tracks_geojson(db: DbSession, current_user: AuthenticatedUser):
    rows = db.execute(
        select(
            GPSTrack.track_id,
            GPSTrack.road_id,
            GPSTrack.recorded_at,
            GPSTrack.source,
            GPSTrack.length_km,
            func.ST_AsGeoJSON(GPSTrack.geometry),
        )
        .where(GPSTrack.geometry.is_not(None))
        .order_by(GPSTrack.track_id)
    ).all()

    features = []
    for track_id, road_id, recorded_at, source, length_km, geometry_json in rows:
        features.append(
            {
                "type": "Feature",
                "geometry": geometry_json and __import__("json").loads(geometry_json),
                "properties": {
                    "track_id": track_id,
                    "road_id": road_id,
                    "recorded_at": recorded_at.isoformat() if recorded_at else None,
                    "source": source,
                    "length_km": float(length_km) if length_km is not None else None,
                },
            }
        )

    return {"type": "FeatureCollection", "features": features}


@router.get("/gps/match")
def match_gps_position(
    db: DbSession,
    current_user: AuthenticatedUser,
    latitude: float = Query(..., ge=-90, le=90),
    longitude: float = Query(..., ge=-180, le=180),
    max_distance_m: float = Query(100, gt=0, le=5000),
):
    gps_point = func.ST_SetSRID(func.ST_MakePoint(longitude, latitude), 4326)
    distance_m = func.ST_Distance(
        func.Geography(RoadSection.geometry),
        func.Geography(gps_point),
    )

    row = db.execute(
        select(
            RoadSection.section_id,
            RoadSection.road_id,
            RoadSection.section_code,
            RoadSection.start_chainage,
            RoadSection.end_chainage,
            RoadSection.length_km,
            Road.road_code,
            Road.road_name,
            distance_m.label("distance_m"),
            func.ST_LineLocatePoint(RoadSection.geometry, gps_point).label("fraction"),
            func.ST_AsGeoJSON(
                func.ST_LineInterpolatePoint(
                    RoadSection.geometry,
                    func.ST_LineLocatePoint(RoadSection.geometry, gps_point),
                )
            ).label("projected_point"),
        )
        .join(Road, Road.road_id == RoadSection.road_id)
        .where(RoadSection.geometry.is_not(None))
        .order_by(distance_m)
        .limit(1)
    ).first()

    if row is None or float(row.distance_m) > max_distance_m:
        return {
            "matched": False,
            "latitude": latitude,
            "longitude": longitude,
            "message": "No road section found within the maximum matching distance",
            "max_distance_m": max_distance_m,
        }

    fraction = max(0.0, min(1.0, float(row.fraction)))
    start_chainage = float(row.start_chainage)
    end_chainage = float(row.end_chainage)
    chainage_km = start_chainage + fraction * (end_chainage - start_chainage)

    return {
        "matched": True,
        "latitude": latitude,
        "longitude": longitude,
        "road_id": row.road_id,
        "road_code": row.road_code,
        "road_name": row.road_name,
        "section_id": row.section_id,
        "section_code": row.section_code,
        "distance_to_section_m": float(row.distance_m),
        "chainage_km": round(chainage_km, 3),
        "chainage_fraction": round(fraction, 6),
        "projected_point": row.projected_point and __import__("json").loads(row.projected_point),
        "message": "Chainage interpolated along the selected road section geometry",
    }


@router.get("/roads/{road_id}/gps-tracks", response_model=list[GPSTrackResponse])
def list_gps_tracks(road_id: int, db: DbSession, current_user: AuthenticatedUser):
    if db.get(Road, road_id) is None:
        raise HTTPException(status_code=404, detail="Road not found")

    return db.scalars(
        select(GPSTrack)
        .where(GPSTrack.road_id == road_id)
        .order_by(GPSTrack.recorded_at.desc(), GPSTrack.track_id.desc())
    ).all()


@router.get("/gps-tracks/{track_id}", response_model=GPSTrackResponse)
def get_gps_track(track_id: int, db: DbSession, current_user: AuthenticatedUser):
    track = db.get(GPSTrack, track_id)
    if track is None:
        raise HTTPException(status_code=404, detail="GPS track not found")
    return track


@router.post(
    "/roads/{road_id}/gps-tracks",
    response_model=GPSTrackResponse,
    status_code=201,
)
def create_gps_track(
    road_id: int,
    payload: GPSTrackCreate,
    db: DbSession,
    current_user: FieldStaffUser,
):
    if db.get(Road, road_id) is None:
        raise HTTPException(status_code=404, detail="Road not found")

    geometry = func.ST_GeomFromText(payload.geometry_wkt, 4326)

    track = GPSTrack(
        road_id=road_id,
        recorded_by=payload.recorded_by,
        recorded_at=payload.recorded_at,
        source=payload.source,
        geometry=geometry,
        length_km=payload.length_km,
    )

    db.add(track)
    try:
        db.commit()
    except Exception:
        db.rollback()
        raise HTTPException(status_code=400, detail="Could not create GPS track")

    db.refresh(track)
    return track
