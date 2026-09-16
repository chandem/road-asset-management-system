from typing import Optional

from geoalchemy2 import Geometry
from sqlalchemy import BigInteger, ForeignKey, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.road import Base


class RoadAsset(Base):
    __tablename__ = "road_assets"
    __table_args__ = {"schema": "rams"}

    asset_id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    road_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("rams.roads.road_id", ondelete="CASCADE"), nullable=False
    )
    section_id: Mapped[Optional[int]] = mapped_column(
        BigInteger, ForeignKey("rams.road_sections.section_id", ondelete="SET NULL")
    )
    asset_type: Mapped[str] = mapped_column(String(50), nullable=False)
    asset_code: Mapped[Optional[str]] = mapped_column(String(80), unique=True)
    chainage_km: Mapped[Optional[float]] = mapped_column(Numeric(12, 3))
    description: Mapped[Optional[str]] = mapped_column(Text)
    condition_rating: Mapped[Optional[float]] = mapped_column(Numeric(5, 2))
    geometry: Mapped[object] = mapped_column(Geometry("GEOMETRY", srid=4326), nullable=True)
