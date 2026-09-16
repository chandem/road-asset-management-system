from typing import Optional

from geoalchemy2 import Geometry
from sqlalchemy import BigInteger, Numeric, String
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    pass


class Road(Base):
    __tablename__ = "roads"
    __table_args__ = {"schema": "rams"}

    road_id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    organization_id: Mapped[Optional[int]] = mapped_column(BigInteger)
    road_code: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    road_name: Mapped[str] = mapped_column(String(200), nullable=False)
    road_class: Mapped[Optional[str]] = mapped_column(String(50))
    surface_type: Mapped[Optional[str]] = mapped_column(String(50))
    start_location: Mapped[Optional[str]] = mapped_column(String(200))
    end_location: Mapped[Optional[str]] = mapped_column(String(200))
    total_length_km: Mapped[Optional[float]] = mapped_column(Numeric(12, 3))
    geometry: Mapped[object] = mapped_column(Geometry("LINESTRING", srid=4326))
    status: Mapped[str] = mapped_column(String(30), default="active", nullable=False)
