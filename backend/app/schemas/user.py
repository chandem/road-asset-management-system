from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


ROLES = ("admin", "engineer", "inspector", "field_staff", "viewer")


class UserCreate(BaseModel):
    username: str = Field(min_length=3, max_length=100)
    full_name: str = Field(min_length=1, max_length=200)
    email: Optional[str] = Field(default=None, max_length=255)
    role: str = Field(default="inspector", max_length=50)
    organization_id: Optional[int] = None


class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    user_id: int
    organization_id: Optional[int] = None
    username: str
    full_name: str
    email: Optional[str] = None
    role: str
    is_active: bool
