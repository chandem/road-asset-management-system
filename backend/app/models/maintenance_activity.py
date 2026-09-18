from datetime import date
from typing import Optional

from sqlalchemy import BigInteger, Date, ForeignKey, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.road import Base


class MaintenanceActivity(Base):
    __tablename__ = "maintenance_activities"
    __table_args__ = {"schema": "rams"}

    maintenance_id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    road_id: Mapped[Optional[int]] = mapped_column(
        BigInteger, ForeignKey("rams.roads.road_id", ondelete="SET NULL")
    )
    asset_id: Mapped[Optional[int]] = mapped_column(
        BigInteger, ForeignKey("rams.road_assets.asset_id", ondelete="SET NULL")
    )
    section_id: Mapped[Optional[int]] = mapped_column(
        BigInteger, ForeignKey("rams.road_sections.section_id", ondelete="SET NULL")
    )
    plan_id: Mapped[Optional[int]] = mapped_column(
        BigInteger, ForeignKey("rams.maintenance_plans.plan_id", ondelete="SET NULL")
    )
    source_defect_id: Mapped[Optional[int]] = mapped_column(
        BigInteger, ForeignKey("rams.road_defects.defect_id", ondelete="SET NULL")
    )
    activity_type: Mapped[str] = mapped_column(String(100), nullable=False)
    priority: Mapped[Optional[str]] = mapped_column(String(30))
    chainage_km: Mapped[Optional[float]] = mapped_column(Numeric(12, 3))
    planned_date: Mapped[Optional[date]] = mapped_column(Date)
    completed_date: Mapped[Optional[date]] = mapped_column(Date)
    estimated_cost: Mapped[Optional[float]] = mapped_column(Numeric(14, 2))
    actual_cost: Mapped[Optional[float]] = mapped_column(Numeric(14, 2))
    contractor: Mapped[Optional[str]] = mapped_column(String(200))
    status: Mapped[str] = mapped_column(String(30), default="planned", nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text)
