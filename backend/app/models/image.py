from datetime import datetime
from typing import Optional

from geoalchemy2 import Geometry
from sqlalchemy import BigInteger, DateTime, Float, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.road import Base


class Image(Base):
    __tablename__ = "images"
    __table_args__ = {"schema": "rams"}

    image_id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    inspection_id: Mapped[Optional[int]] = mapped_column(
        BigInteger, ForeignKey("rams.inspections.inspection_id", ondelete="SET NULL")
    )
    defect_id: Mapped[Optional[int]] = mapped_column(
        BigInteger, ForeignKey("rams.road_defects.defect_id", ondelete="SET NULL")
    )
    file_name: Mapped[str] = mapped_column(String(255), nullable=False)
    file_path: Mapped[str] = mapped_column(Text, nullable=False)
    captured_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    latitude: Mapped[Optional[float]] = mapped_column(Float)
    longitude: Mapped[Optional[float]] = mapped_column(Float)
    geometry: Mapped[object] = mapped_column(Geometry("POINT", srid=4326), nullable=True)
