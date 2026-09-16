from typing import Optional

from sqlalchemy import BigInteger, Boolean, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from app.models.road import Base


class User(Base):
    __tablename__ = "users"
    __table_args__ = {"schema": "rams"}

    user_id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    organization_id: Mapped[Optional[int]] = mapped_column(
        BigInteger,
        ForeignKey("rams.organizations.organization_id", ondelete="SET NULL"),
    )
    username: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    full_name: Mapped[str] = mapped_column(String(200), nullable=False)
    email: Mapped[Optional[str]] = mapped_column(String(255), unique=True)
    role: Mapped[str] = mapped_column(String(50), nullable=False, default="inspector")
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    password_hash: Mapped[Optional[str]] = mapped_column(String(255))
