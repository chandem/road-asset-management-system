from typing import Optional

from geoalchemy2 import Geometry
from sqlalchemy import BigInteger, ForeignKey, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.road import Base


class RoadDefect(Base):
    __tablename__ = "road_defects"
    __table_args__ = {"schema": "rams"}

    defect_id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    inspection_id: Mapped[int] = mapped_column(
        BigInteger,
        ForeignKey("rams.inspections.inspection_id", ondelete="CASCADE"),
        nullable=False,
    )
    defect_type: Mapped[str] = mapped_column(String(80), nullable=False)
    severity: Mapped[Optional[str]] = mapped_column(String(30))
    chainage_start: Mapped[Optional[float]] = mapped_column(Numeric(12, 3))
    chainage_end: Mapped[Optional[float]] = mapped_column(Numeric(12, 3))
    quantity: Mapped[Optional[float]] = mapped_column(Numeric(12, 3))
    unit: Mapped[Optional[str]] = mapped_column(String(30))
    description: Mapped[Optional[str]] = mapped_column(Text)
    geometry: Mapped[object] = mapped_column(Geometry("GEOMETRY", srid=4326), nullable=True)
