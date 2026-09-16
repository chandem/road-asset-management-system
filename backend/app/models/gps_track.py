from datetime import datetime
from typing import Optional

from geoalchemy2 import Geometry
from sqlalchemy import BigInteger, DateTime, ForeignKey, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column

from app.models.road import Base


class GPSTrack(Base):
    __tablename__ = "gps_tracks"
    __table_args__ = {"schema": "rams"}

    track_id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    road_id: Mapped[Optional[int]] = mapped_column(
        BigInteger, ForeignKey("rams.roads.road_id", ondelete="CASCADE")
    )
    recorded_by: Mapped[Optional[int]] = mapped_column(
        BigInteger, ForeignKey("rams.users.user_id", ondelete="SET NULL")
    )
    recorded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    source: Mapped[Optional[str]] = mapped_column(String(50))
    geometry: Mapped[object] = mapped_column(
        Geometry("LINESTRING", srid=4326), nullable=True
    )
    length_km: Mapped[Optional[float]] = mapped_column(Numeric(12, 3))
