"""Additional security unit tests (tokens and roles)."""

import os

os.environ.setdefault(
    "JWT_SECRET_KEY",
    "test-secret-key-for-rams-unit-tests-32-chars-minimum",
)

import pytest
from fastapi import HTTPException
from jose import jwt

from app.core.security import create_access_token, decode_access_token, require_roles
from app.models.user import User


def test_decode_access_token_rejects_tampered_token():
    token = create_access_token("1", "admin")
    parts = token.split(".")
    # Corrupt payload segment
    tampered = f"{parts[0]}.{parts[1][:-2]}xx.{parts[2]}"
    with pytest.raises(ValueError, match="Invalid or expired token"):
        decode_access_token(tampered)


def test_decode_access_token_rejects_wrong_secret():
    token = jwt.encode(
        {"sub": "1", "role": "admin"},
        "different-secret-key-not-matching-32chars",
        algorithm="HS256",
    )
    with pytest.raises(ValueError, match="Invalid or expired token"):
        decode_access_token(token)


def test_require_roles_allows_admin_for_any_protected_set():
    admin = User(
        user_id=1,
        username="admin",
        full_name="Admin",
        role="admin",
        is_active=True,
    )
    dependency = require_roles("engineer", "inspector")
    # Admin is not in the set — should be rejected
    with pytest.raises(HTTPException) as exc_info:
        dependency(admin)
    assert exc_info.value.status_code == 403


def test_require_roles_allows_field_staff_when_listed():
    user = User(
        user_id=3,
        username="field1",
        full_name="Field Staff",
        role="field_staff",
        is_active=True,
    )
    dependency = require_roles("admin", "engineer", "inspector", "field_staff")
    assert dependency(user) is user
