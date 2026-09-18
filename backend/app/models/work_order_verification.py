from datetime import datetime
from typing import Optional

from sqlalchemy import BigInteger, DateTime, Float, Numeric, String, Text, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column

from app.models.road import Base


class WorkOrderVerification(Base):
    __tablename__ = "work_order_verifications"
    __table_args__ = {"schema": "rams"}

    verification_id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    work_order_id: Mapped[int] = mapped_column(
        BigInteger,
        ForeignKey("rams.work_orders.work_order_id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
    )
    verified_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    verified_by: Mapped[str] = mapped_column(String(200), nullable=False)
    result: Mapped[str] = mapped_column(String(30), nullable=False, default="accepted")
    completed_quantity: Mapped[Optional[float]] = mapped_column(Numeric(14, 3))
    final_condition: Mapped[Optional[str]] = mapped_column(String(50))
    gps_latitude: Mapped[Optional[float]] = mapped_column(Float)
    gps_longitude: Mapped[Optional[float]] = mapped_column(Float)
    remarks: Mapped[Optional[str]] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
