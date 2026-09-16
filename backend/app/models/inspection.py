from typing import Optional

from sqlalchemy import BigInteger, Date, ForeignKey, Numeric, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.road import Base


class Inspection(Base):
    __tablename__ = "inspections"
    __table_args__ = {"schema": "rams"}

    inspection_id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    road_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("rams.roads.road_id", ondelete="CASCADE"), nullable=False
    )
    section_id: Mapped[Optional[int]] = mapped_column(
        BigInteger, ForeignKey("rams.road_sections.section_id", ondelete="SET NULL")
    )
    inspection_date: Mapped[Date] = mapped_column(Date, nullable=False)
    inspector_id: Mapped[Optional[int]] = mapped_column(BigInteger)
    overall_condition: Mapped[Optional[float]] = mapped_column(Numeric(5, 2))
    notes: Mapped[Optional[str]] = mapped_column(Text)
