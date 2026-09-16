from typing import Optional

from geoalchemy2 import Geometry
from sqlalchemy import BigInteger, ForeignKey, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column

from app.models.road import Base


class ChainagePoint(Base):
    __tablename__ = "chainage_points"
    __table_args__ = {"schema": "rams"}

    point_id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    section_id: Mapped[int] = mapped_column(
        BigInteger,
        ForeignKey("rams.road_sections.section_id", ondelete="CASCADE"),
        nullable=False,
    )
    chainage_km: Mapped[float] = mapped_column(Numeric(12, 3), nullable=False)
    latitude: Mapped[float] = mapped_column(Numeric(10, 7), nullable=False)
    longitude: Mapped[float] = mapped_column(Numeric(10, 7), nullable=False)
    elevation_m: Mapped[Optional[float]] = mapped_column(Numeric(10, 3))
    utm_zone: Mapped[Optional[str]] = mapped_column(String(20))
    utm_easting: Mapped[Optional[float]] = mapped_column(Numeric(12, 3))
    utm_northing: Mapped[Optional[float]] = mapped_column(Numeric(12, 3))
    geometry: Mapped[object] = mapped_column(
        Geometry("POINT", srid=4326), nullable=False
    )
