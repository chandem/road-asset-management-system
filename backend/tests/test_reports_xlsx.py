"""Excel export endpoint smoke test."""

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
    def scalar(self, statement):
        return 0

    def scalars(self, statement):
        class _Result:
            def all(self_inner):
                return []

        return _Result()

    def execute(self, statement):
        class _Result:
            def all(self_inner):
                return []

            def __iter__(self_inner):
                return iter(self_inner.all())

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


client = TestClient(app)


def test_reports_export_xlsx():
    user = make_user()
    fake = FakeDB()

    def _user():
        return user

    def _db():
        yield fake

    app.dependency_overrides[get_current_user] = _user
    app.dependency_overrides[get_db] = _db
    try:
        response = client.get("/api/v1/reports/export.xlsx")
        assert response.status_code == 200, response.text
        assert "spreadsheetml" in response.headers.get("content-type", "")
        assert response.content[:2] == b"PK"  # zip/xlsx magic
    finally:
        app.dependency_overrides.clear()
