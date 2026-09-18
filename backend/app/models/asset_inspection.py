from datetime import date
from typing import Optional
from sqlalchemy import BigInteger, Date, ForeignKey, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column
from app.models.road import Base

class AssetInspection(Base):
    __tablename__ = "asset_inspections"
    __table_args__ = {"schema": "rams"}
    asset_inspection_id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    asset_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("rams.road_assets.asset_id", ondelete="CASCADE"), nullable=False)
    inspection_date: Mapped[date] = mapped_column(Date, nullable=False)
    inspector_id: Mapped[Optional[int]] = mapped_column(BigInteger, ForeignKey("rams.users.user_id", ondelete="SET NULL"))
    condition_rating: Mapped[Optional[float]] = mapped_column(Numeric(5, 2))
    defect_status: Mapped[Optional[str]] = mapped_column(String(50))
    notes: Mapped[Optional[str]] = mapped_column(Text)
