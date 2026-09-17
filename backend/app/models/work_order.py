from datetime import date, datetime

from sqlalchemy import BigInteger, Date, DateTime, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.road import Base


class WorkOrder(Base):
    __tablename__ = "work_orders"
    __table_args__ = {"schema": "rams"}

    work_order_id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    maintenance_id: Mapped[int] = mapped_column(
        BigInteger,
        ForeignKey("rams.maintenance_activities.maintenance_id", ondelete="CASCADE"),
        nullable=False,
    )
    order_number: Mapped[str] = mapped_column(String(100), nullable=False, unique=True)
    issue_date: Mapped[date] = mapped_column(Date, nullable=False)
    due_date: Mapped[date | None] = mapped_column(Date)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="draft")
    assigned_to: Mapped[str | None] = mapped_column(String(200))
    instructions: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
