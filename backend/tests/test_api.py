"""API-level tests using FastAPI TestClient and dependency overrides.

These do not require a live PostgreSQL instance.
"""

from __future__ import annotations

import os

os.environ.setdefault(
    "JWT_SECRET_KEY",
    "test-secret-key-for-rams-unit-tests-32-chars-minimum",
)
os.environ.setdefault(
    "DATABASE_URL",
    "postgresql+psycopg://rams_user:change_me@localhost:5432/rams",
)
os.environ.setdefault("TRUSTED_HOSTS", "testserver,localhost,127.0.0.1")

from fastapi.testclient import TestClient

from app.core.security import get_current_user
from app.db.session import get_db
from app.main import app
from app.models.user import User


class FakeDB:
    """Minimal session stand-in for route tests."""

    def __init__(self, *, user=None, road=None):
        self._user = user
        self._road = road

    def scalar(self, statement):
        # Used by login: select(User).where(...)
        return self._user

    def get(self, model, object_id):
        if model is User:
            if self._user is not None and getattr(self._user, "user_id", None) == object_id:
                return self._user
            return None
        if self._road is not None and getattr(self._road, "road_id", None) == object_id:
            return self._road
        return None

    def scalars(self, statement):
        class _Result:
            def all(self_inner):
                return []

        return _Result()


def make_user(**overrides) -> User:
    values = {
        "user_id": 1,
        "username": "admin",
        "full_name": "Admin User",
        "email": "admin@example.com",
        "role": "admin",
        "is_active": True,
        "password_hash": None,
    }
    values.update(overrides)
    return User(**values)


def override_db(fake: FakeDB):
    def _get_db():
        yield fake

    return _get_db


client = TestClient(app)


def test_health_check():
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert data["service"] == "rams-api"


def test_login_validation_error_shape():
    response = client.post("/api/v1/auth/login", json={})
    assert response.status_code == 422
    body = response.json()
    assert "error" in body
    assert body["error"]["code"] == "validation_error"
    assert body["error"]["message"] == "Request validation failed"
    assert isinstance(body["error"]["details"], list)
    assert len(body["error"]["details"]) >= 1


def test_login_invalid_credentials_returns_401():
    fake = FakeDB(user=None)
    app.dependency_overrides[get_db] = override_db(fake)
    try:
        response = client.post(
            "/api/v1/auth/login",
            json={"username": "nobody", "password": "wrong-pass"},
        )
        assert response.status_code == 401
        body = response.json()
        assert body["detail"] == "Invalid username or password"
        assert body["error"]["code"] == "unauthorized"
        assert body["error"]["message"] == "Invalid username or password"
    finally:
        app.dependency_overrides.clear()


def test_roads_require_authentication():
    response = client.get("/api/v1/roads")
    assert response.status_code == 401
    body = response.json()
    assert body["error"]["code"] == "unauthorized"


def test_get_road_not_found_with_auth_override():
    user = make_user()
    fake = FakeDB(user=user, road=None)

    app.dependency_overrides[get_db] = override_db(fake)
    app.dependency_overrides[get_current_user] = lambda: user
    try:
        response = client.get("/api/v1/roads/99999")
        assert response.status_code == 404
        body = response.json()
        assert body["detail"] == "Road not found"
        assert body["error"]["code"] == "not_found"
        assert body["error"]["message"] == "Road not found"
    finally:
        app.dependency_overrides.clear()


def test_list_roads_empty_with_auth_override():
    user = make_user(role="engineer")
    fake = FakeDB(user=user)

    app.dependency_overrides[get_db] = override_db(fake)
    app.dependency_overrides[get_current_user] = lambda: user
    try:
        response = client.get("/api/v1/roads")
        assert response.status_code == 200
        assert response.json() == []
    finally:
        app.dependency_overrides.clear()
