from datetime import date
from typing import Optional

from sqlalchemy import BigInteger, Date, ForeignKey, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.road import Base


class MaintenanceActivity(Base):
    __tablename__ = "maintenance_activities"
    __table_args__ = {"schema": "rams"}

    activity_id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    road_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("rams.roads.road_id", ondelete="CASCADE"), nullable=False
    )
    section_id: Mapped[Optional[int]] = mapped_column(
        BigInteger, ForeignKey("rams.road_sections.section_id", ondelete="SET NULL")
    )
    activity_type: Mapped[str] = mapped_column(String(80), nullable=False)
    planned_date: Mapped[Optional[date]] = mapped_column(Date)
    completed_date: Mapped[Optional[date]] = mapped_column(Date)
    contractor: Mapped[Optional[str]] = mapped_column(String(200))
    estimated_cost: Mapped[Optional[float]] = mapped_column(Numeric(14, 2))
    actual_cost: Mapped[Optional[float]] = mapped_column(Numeric(14, 2))
    status: Mapped[str] = mapped_column(String(30), default="planned", nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text)
