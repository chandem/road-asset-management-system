"""Baseline RAMS schema (PostGIS).

Revision ID: 0001_baseline
Revises:
Create Date: 2026-09-17

Applies database/schema.sql for empty databases.
Safe on existing DBs that already have the RAMS schema.
"""
from __future__ import annotations

from pathlib import Path

from alembic import op
from sqlalchemy import text

revision = "0001_baseline"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()
    exists = conn.execute(
        text(
            "SELECT EXISTS ("
            "  SELECT 1 FROM information_schema.tables "
            "  WHERE table_schema = 'rams' AND table_name = 'roads'"
            ")"
        )
    ).scalar()
    if exists:
        return

    candidates = [
        Path("/database/schema.sql"),
        Path(__file__).resolve().parents[3] / "database" / "schema.sql",
        Path(__file__).resolve().parents[2] / "database" / "schema.sql",
    ]
    schema_path = next((p for p in candidates if p.is_file()), None)
    if schema_path is None:
        raise FileNotFoundError(
            "Could not find database/schema.sql. "
            "Mount ./database to /database in Docker or run from the repo root."
        )
    sql = schema_path.read_text(encoding="utf-8")
    conn.execute(text(sql))


def downgrade() -> None:
    raise NotImplementedError(
        "Downgrade of the baseline schema is not supported. "
        "Drop the database and re-run migrations if you need a clean slate."
    )
