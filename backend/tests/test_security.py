import os

os.environ.setdefault(
    "JWT_SECRET_KEY",
    "test-secret-key-for-rams-unit-tests-32-chars-minimum",
)

from fastapi import HTTPException

from app.core.security import (
    create_access_token,
    decode_access_token,
    hash_password,
    require_roles,
    verify_password,
)
from app.models.user import User


def test_password_hash_and_verify():
    password = "StrongPassword123!"
    password_hash = hash_password(password)

    assert password_hash != password
    assert verify_password(password, password_hash)
    assert not verify_password("wrong-password", password_hash)


def test_access_token_round_trip():
    token = create_access_token("42", "engineer")
    payload = decode_access_token(token)

    assert payload["sub"] == "42"
    assert payload["role"] == "engineer"
    assert "exp" in payload


def test_require_roles_allows_matching_role():
    user = User(
        user_id=1,
        username="engineer1",
        full_name="Engineer One",
        role="engineer",
        is_active=True,
    )

    dependency = require_roles("admin", "engineer")
    assert dependency(user) is user


def test_require_roles_rejects_non_matching_role():
    user = User(
        user_id=2,
        username="viewer1",
        full_name="Viewer One",
        role="viewer",
        is_active=True,
    )

    dependency = require_roles("admin", "engineer")

    try:
        dependency(user)
    except HTTPException as exc:
        assert exc.status_code == 403
        assert exc.detail == "You do not have permission to perform this action"
    else:
        raise AssertionError("Expected a 403 HTTPException")
