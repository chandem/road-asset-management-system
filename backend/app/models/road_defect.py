from typing import Optional

from geoalchemy2 import Geometry
from sqlalchemy import BigInteger, ForeignKey, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.road import Base


class RoadDefect(Base):
    __tablename__ = "road_defects"
    __table_args__ = {"schema": "rams"}

    defect_id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    inspection_id: Mapped[Optional[int]] = mapped_column(
        BigInteger,
        ForeignKey("rams.inspections.inspection_id", ondelete="CASCADE"),
    )
    section_id: Mapped[Optional[int]] = mapped_column(
        BigInteger,
        ForeignKey("rams.road_sections.section_id", ondelete="SET NULL"),
    )
    client_id: Mapped[Optional[str]] = mapped_column(String(100), unique=True)
    defect_type: Mapped[str] = mapped_column(String(100), nullable=False)
    severity: Mapped[Optional[str]] = mapped_column(String(30))
    chainage_km: Mapped[Optional[float]] = mapped_column(Numeric(12, 3))
    length_m: Mapped[Optional[float]] = mapped_column(Numeric(10, 2))
    width_m: Mapped[Optional[float]] = mapped_column(Numeric(10, 2))
    depth_mm: Mapped[Optional[float]] = mapped_column(Numeric(10, 2))
    description: Mapped[Optional[str]] = mapped_column(Text)
    geometry: Mapped[object] = mapped_column(Geometry("GEOMETRY", srid=4326), nullable=True)
    detected_by: Mapped[str] = mapped_column(String(30), nullable=False, default="manual")
