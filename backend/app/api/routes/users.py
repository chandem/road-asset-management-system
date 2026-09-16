from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.user import User
from app.schemas.user import UserCreate, UserResponse, ROLES

router = APIRouter(tags=["Users"])
DbSession = Annotated[Session, Depends(get_db)]


@router.get("/users", response_model=list[UserResponse])
def list_users(db: DbSession):
    return db.scalars(select(User).order_by(User.full_name, User.user_id)).all()


@router.get("/users/{user_id}", response_model=UserResponse)
def get_user(user_id: int, db: DbSession):
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")
    return user


@router.post("/users", response_model=UserResponse, status_code=201)
def create_user(payload: UserCreate, db: DbSession):
    if payload.role not in ROLES:
        raise HTTPException(status_code=400, detail=f"Invalid role. Use one of: {', '.join(ROLES)}")

    if db.scalar(select(User).where(User.username == payload.username)) is not None:
        raise HTTPException(status_code=409, detail="Username already exists")
    if payload.email and db.scalar(select(User).where(User.email == payload.email)) is not None:
        raise HTTPException(status_code=409, detail="Email already exists")

    user = User(
        username=payload.username,
        full_name=payload.full_name,
        email=payload.email,
        role=payload.role,
        organization_id=payload.organization_id,
    )
    db.add(user)
    try:
        db.commit()
    except Exception:
        db.rollback()
        raise HTTPException(status_code=400, detail="Could not create user")
    db.refresh(user)
    return user
