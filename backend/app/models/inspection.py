from datetime import date
from typing import Optional

from sqlalchemy import BigInteger, Date, ForeignKey, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.road import Base


class Inspection(Base):
    __tablename__ = "inspections"
    __table_args__ = {"schema": "rams"}

    inspection_id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    section_id: Mapped[int] = mapped_column(
        BigInteger,
        ForeignKey("rams.road_sections.section_id", ondelete="CASCADE"),
        nullable=False,
    )
    inspector_id: Mapped[Optional[int]] = mapped_column(BigInteger)
    client_id: Mapped[Optional[str]] = mapped_column(String(100), unique=True)
    inspection_date: Mapped[date] = mapped_column(Date, nullable=False)
    condition_rating: Mapped[Optional[float]] = mapped_column(Numeric(5, 2))
    weather: Mapped[Optional[str]] = mapped_column(String(100))
    notes: Mapped[Optional[str]] = mapped_column(Text)
