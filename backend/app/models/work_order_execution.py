from datetime import datetime
from typing import Optional

from sqlalchemy import BigInteger, DateTime, Float, Numeric, String, Text, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column

from app.models.road import Base


class WorkOrderExecution(Base):
    __tablename__ = "work_order_executions"
    __table_args__ = {"schema": "rams"}

    execution_id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    work_order_id: Mapped[int] = mapped_column(
        BigInteger,
        ForeignKey("rams.work_orders.work_order_id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
    )
    started_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    crew: Mapped[Optional[str]] = mapped_column(Text)
    equipment: Mapped[Optional[str]] = mapped_column(Text)
    materials: Mapped[Optional[str]] = mapped_column(Text)
    planned_quantity: Mapped[Optional[float]] = mapped_column(Numeric(14, 3))
    actual_quantity: Mapped[Optional[float]] = mapped_column(Numeric(14, 3))
    quantity_unit: Mapped[Optional[str]] = mapped_column(String(50))
    actual_cost: Mapped[Optional[float]] = mapped_column(Numeric(14, 2))
    gps_latitude: Mapped[Optional[float]] = mapped_column(Float)
    gps_longitude: Mapped[Optional[float]] = mapped_column(Float)
    notes: Mapped[Optional[str]] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
