from datetime import datetime
from typing import Any

from sqlalchemy import BigInteger, DateTime, ForeignKey, JSON, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.road import Base


class WorkOrderHistory(Base):
    __tablename__ = "work_order_history"
    __table_args__ = {"schema": "rams"}

    history_id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    work_order_id: Mapped[int] = mapped_column(
        BigInteger,
        ForeignKey("rams.work_orders.work_order_id", ondelete="CASCADE"),
        nullable=False,
    )
    changed_by: Mapped[int | None] = mapped_column(
        BigInteger,
        ForeignKey("rams.users.user_id", ondelete="SET NULL"),
    )
    action: Mapped[str] = mapped_column(String(30), nullable=False)
    changed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    old_values: Mapped[Any | None] = mapped_column(JSON)
    new_values: Mapped[Any | None] = mapped_column(JSON)
