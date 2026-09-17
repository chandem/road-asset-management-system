from datetime import date, datetime
from typing import Optional

from sqlalchemy import Date, DateTime, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class MaintenancePlan(Base):
    __tablename__ = "maintenance_plans"
    __table_args__ = {"schema": "rams"}

    plan_id: Mapped[int] = mapped_column(primary_key=True)
    plan_year: Mapped[int] = mapped_column(nullable=False)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    budget: Mapped[Optional[float]] = mapped_column(Numeric(14, 2))
    start_date: Mapped[Optional[date]] = mapped_column(Date)
    end_date: Mapped[Optional[date]] = mapped_column(Date)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="draft")
    description: Mapped[Optional[str]] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
