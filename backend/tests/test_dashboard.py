"""Dashboard summary endpoint tests (no live Postgres required)."""

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


def test_dashboard_summary_returns_counts_and_lists():
    user = make_user()
    fake = FakeDB()

    def _user():
        return user

    def _db():
        yield fake

    app.dependency_overrides[get_current_user] = _user
    app.dependency_overrides[get_db] = _db
    try:
        response = client.get("/api/v1/dashboard/summary")
        assert response.status_code == 200, response.text
        body = response.json()
        assert "counts" in body
        assert "roads" in body
        assert "sections" in body
        for key in (
            "roads",
            "sections",
            "assets",
            "inspections",
            "defects",
            "maintenance",
            "work_orders",
            "gps_tracks",
        ):
            assert key in body["counts"]
            assert body["counts"][key] == 0
        assert body["roads"] == []
        assert body["sections"] == []
    finally:
        app.dependency_overrides.clear()


def test_dashboard_attention_shape():
    user = make_user()
    fake = FakeDB()

    def _user():
        return user

    def _db():
        yield fake

    app.dependency_overrides[get_current_user] = _user
    app.dependency_overrides[get_db] = _db
    try:
        response = client.get("/api/v1/dashboard/attention")
        assert response.status_code == 200, response.text
        body = response.json()
        assert "overdue_work_orders" in body
        assert "high_severity_defects" in body
        assert "overdue_maintenance" in body
        assert "over_budget_plans" in body
        assert "totals" in body
        assert "as_of" in body
    finally:
        app.dependency_overrides.clear()
