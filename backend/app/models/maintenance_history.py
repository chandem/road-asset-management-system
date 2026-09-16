from datetime import datetime
from typing import Any, Optional

from sqlalchemy import BigInteger, DateTime, ForeignKey, String
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.models.road import Base


class MaintenanceHistory(Base):
    __tablename__ = "maintenance_history"
    __table_args__ = {"schema": "rams"}

    history_id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    maintenance_id: Mapped[int] = mapped_column(
        BigInteger,
        ForeignKey("rams.maintenance_activities.maintenance_id", ondelete="CASCADE"),
        nullable=False,
    )
    changed_by: Mapped[Optional[int]] = mapped_column(
        BigInteger,
        ForeignKey("rams.users.user_id", ondelete="SET NULL"),
    )
    action: Mapped[str] = mapped_column(String(30), nullable=False)
    changed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
    old_values: Mapped[Optional[dict[str, Any]]] = mapped_column(JSONB)
    new_values: Mapped[Optional[dict[str, Any]]] = mapped_column(JSONB)
