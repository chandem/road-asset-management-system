from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import OAuth2PasswordBearer
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import create_access_token, decode_access_token, hash_password, verify_password
from app.db.session import get_db
from app.models.user import User

router = APIRouter(tags=["Authentication"])
DbSession = Annotated[Session, Depends(get_db)]
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")


class LoginRequest(BaseModel):
    username: str = Field(min_length=1)
    password: str = Field(min_length=1, max_length=72)


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user_id: int
    username: str
    full_name: str
    role: str


class PasswordSetupRequest(BaseModel):
    user_id: int
    password: str = Field(min_length=8, max_length=72)


@router.post("/auth/login", response_model=LoginResponse)
def login(payload: LoginRequest, db: DbSession):
    user = db.scalar(select(User).where(User.username == payload.username))
    if user is None or not user.is_active or not getattr(user, "password_hash", None):
        raise HTTPException(status_code=401, detail="Invalid username or password")
    if not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid username or password")

    return LoginResponse(
        access_token=create_access_token(str(user.user_id), user.role),
        user_id=user.user_id,
        username=user.username,
        full_name=user.full_name,
        role=user.role,
    )


@router.get("/auth/me", response_model=LoginResponse)
def me(token: Annotated[str, Depends(oauth2_scheme)], db: DbSession):
    try:
        payload = decode_access_token(token)
        user_id = int(payload["sub"])
    except (ValueError, KeyError, TypeError):
        raise HTTPException(
            status_code=401,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user = db.get(User, user_id)
    if user is None or not user.is_active:
        raise HTTPException(
            status_code=401,
            detail="User is not active",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return LoginResponse(
        access_token=token,
        user_id=user.user_id,
        username=user.username,
        full_name=user.full_name,
        role=user.role,
    )
