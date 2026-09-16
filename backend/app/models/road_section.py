from typing import Optional

from geoalchemy2 import Geometry
from sqlalchemy import BigInteger, ForeignKey, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column

from app.models.road import Base


class RoadSection(Base):
    __tablename__ = "road_sections"
    __table_args__ = {"schema": "rams"}

    section_id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    road_id: Mapped[int] = mapped_column(
        BigInteger,
        ForeignKey("rams.roads.road_id", ondelete="CASCADE"),
        nullable=False,
    )
    section_code: Mapped[str] = mapped_column(String(80), unique=True, nullable=False)
    start_chainage: Mapped[float] = mapped_column(Numeric(12, 3), nullable=False)
    end_chainage: Mapped[float] = mapped_column(Numeric(12, 3), nullable=False)
    length_km: Mapped[Optional[float]] = mapped_column(Numeric(12, 3))
    surface_type: Mapped[Optional[str]] = mapped_column(String(50))
    condition_rating: Mapped[Optional[float]] = mapped_column(Numeric(5, 2))
    geometry: Mapped[object] = mapped_column(
        Geometry("LINESTRING", srid=4326), nullable=True
    )
