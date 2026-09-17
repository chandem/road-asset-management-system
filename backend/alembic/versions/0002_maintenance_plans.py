"""Ensure maintenance_plans and related columns exist.

Revision ID: 0002_maintenance_plans
Revises: 0001_baseline
Create Date: 2026-09-17

Idempotent migration for databases created from an older schema.sql
that did not yet include maintenance_plans.
"""
from __future__ import annotations

from alembic import op
from sqlalchemy import text

revision = "0002_maintenance_plans"
down_revision = "0001_baseline"
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()
    conn.execute(text("SET search_path TO rams, public"))
    conn.execute(text("""
        CREATE TABLE IF NOT EXISTS maintenance_plans (
            plan_id BIGSERIAL PRIMARY KEY,
            plan_year INTEGER NOT NULL,
            name VARCHAR(200) NOT NULL,
            budget NUMERIC(14,2),
            start_date DATE,
            end_date DATE,
            status VARCHAR(30) NOT NULL DEFAULT 'draft',
            description TEXT,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            CHECK (plan_year >= 2000 AND plan_year <= 2100),
            CHECK (budget IS NULL OR budget >= 0),
            CHECK (end_date IS NULL OR start_date IS NULL OR end_date >= start_date),
            CHECK (status IN ('draft', 'approved', 'in progress', 'completed', 'cancelled'))
        )
    """))
    conn.execute(text("""
        ALTER TABLE maintenance_activities
            ADD COLUMN IF NOT EXISTS plan_id BIGINT
            REFERENCES maintenance_plans(plan_id) ON DELETE SET NULL
    """))
    conn.execute(text("""
        CREATE INDEX IF NOT EXISTS idx_maintenance_plans_year
            ON maintenance_plans (plan_year)
    """))
    conn.execute(text("""
        CREATE INDEX IF NOT EXISTS idx_maintenance_plans_status
            ON maintenance_plans (status)
    """))
    conn.execute(text("""
        CREATE INDEX IF NOT EXISTS idx_maintenance_activities_plan
            ON maintenance_activities (plan_id)
    """))
    conn.execute(text("""
        ALTER TABLE inspections
            ADD COLUMN IF NOT EXISTS client_id VARCHAR(100)
    """))
    conn.execute(text("""
        CREATE UNIQUE INDEX IF NOT EXISTS uq_inspections_client_id
            ON inspections (client_id)
            WHERE client_id IS NOT NULL
    """))
    conn.execute(text("""
        CREATE INDEX IF NOT EXISTS idx_users_username ON users (username)
    """))


def downgrade() -> None:
    conn = op.get_bind()
    conn.execute(text("SET search_path TO rams, public"))
    conn.execute(text("DROP INDEX IF EXISTS idx_maintenance_activities_plan"))
    conn.execute(text("DROP INDEX IF EXISTS idx_maintenance_plans_status"))
    conn.execute(text("DROP INDEX IF EXISTS idx_maintenance_plans_year"))
    conn.execute(text("ALTER TABLE maintenance_activities DROP COLUMN IF EXISTS plan_id"))
    conn.execute(text("DROP TABLE IF EXISTS maintenance_plans"))
