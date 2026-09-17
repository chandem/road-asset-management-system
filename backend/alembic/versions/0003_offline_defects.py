"""Add idempotency support for offline road-defect synchronization.

Revision ID: 0003_offline_defects
Revises: 0002_maintenance_plans
Create Date: 2026-09-17
"""
from __future__ import annotations

from alembic import op
from sqlalchemy import text

revision = "0003_offline_defects"
down_revision = "0002_maintenance_plans"
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()
    conn.execute(text("SET search_path TO rams, public"))
    conn.execute(text("ALTER TABLE road_defects ADD COLUMN IF NOT EXISTS client_id VARCHAR(100)"))
    conn.execute(text("""
        CREATE UNIQUE INDEX IF NOT EXISTS uq_road_defects_client_id
        ON road_defects (client_id)
        WHERE client_id IS NOT NULL
    """))


def downgrade() -> None:
    conn = op.get_bind()
    conn.execute(text("SET search_path TO rams, public"))
    conn.execute(text("DROP INDEX IF EXISTS uq_road_defects_client_id"))
    conn.execute(text("ALTER TABLE road_defects DROP COLUMN IF EXISTS client_id"))
