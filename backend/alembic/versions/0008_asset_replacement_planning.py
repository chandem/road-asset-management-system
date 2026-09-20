"""Add asset replacement planning fields.

Revision ID: 0008_asset_replacement_planning
Revises: 0007_asset_defect_link

Idempotent: columns may already exist from an updated schema.sql.
"""
from __future__ import annotations

from alembic import op
from sqlalchemy import text

revision = "0008_asset_replacement_planning"
down_revision = "0007_asset_defect_link"
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()
    conn.execute(text("SET search_path TO rams, public"))

    conn.execute(text("""
        ALTER TABLE road_assets
            ADD COLUMN IF NOT EXISTS criticality INTEGER NOT NULL DEFAULT 3
    """))
    conn.execute(text("""
        ALTER TABLE road_assets
            ADD COLUMN IF NOT EXISTS commissioning_year INTEGER
    """))
    conn.execute(text("""
        ALTER TABLE road_assets
            ADD COLUMN IF NOT EXISTS expected_life_years INTEGER
    """))
    conn.execute(text("""
        ALTER TABLE road_assets
            ADD COLUMN IF NOT EXISTS replacement_cost NUMERIC(14, 2)
    """))
    conn.execute(text("""
        ALTER TABLE road_assets
            ADD COLUMN IF NOT EXISTS replacement_threshold NUMERIC(5, 2)
            NOT NULL DEFAULT 40
    """))

    conn.execute(text("""
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM pg_constraint
                WHERE conname = 'ck_road_assets_criticality'
                  AND conrelid = 'rams.road_assets'::regclass
            ) THEN
                ALTER TABLE road_assets
                    ADD CONSTRAINT ck_road_assets_criticality
                    CHECK (criticality BETWEEN 1 AND 5);
            END IF;

            IF NOT EXISTS (
                SELECT 1 FROM pg_constraint
                WHERE conname = 'ck_road_assets_expected_life'
                  AND conrelid = 'rams.road_assets'::regclass
            ) THEN
                ALTER TABLE road_assets
                    ADD CONSTRAINT ck_road_assets_expected_life
                    CHECK (expected_life_years IS NULL OR expected_life_years >= 1);
            END IF;

            IF NOT EXISTS (
                SELECT 1 FROM pg_constraint
                WHERE conname = 'ck_road_assets_replacement_cost'
                  AND conrelid = 'rams.road_assets'::regclass
            ) THEN
                ALTER TABLE road_assets
                    ADD CONSTRAINT ck_road_assets_replacement_cost
                    CHECK (replacement_cost IS NULL OR replacement_cost >= 0);
            END IF;

            IF NOT EXISTS (
                SELECT 1 FROM pg_constraint
                WHERE conname = 'ck_road_assets_replacement_threshold'
                  AND conrelid = 'rams.road_assets'::regclass
            ) THEN
                ALTER TABLE road_assets
                    ADD CONSTRAINT ck_road_assets_replacement_threshold
                    CHECK (replacement_threshold BETWEEN 0 AND 100);
            END IF;
        END $$;
    """))


def downgrade() -> None:
    conn = op.get_bind()
    conn.execute(text("SET search_path TO rams, public"))
    conn.execute(text("ALTER TABLE road_assets DROP CONSTRAINT IF EXISTS ck_road_assets_replacement_threshold"))
    conn.execute(text("ALTER TABLE road_assets DROP CONSTRAINT IF EXISTS ck_road_assets_replacement_cost"))
    conn.execute(text("ALTER TABLE road_assets DROP CONSTRAINT IF EXISTS ck_road_assets_expected_life"))
    conn.execute(text("ALTER TABLE road_assets DROP CONSTRAINT IF EXISTS ck_road_assets_criticality"))
    conn.execute(text("ALTER TABLE road_assets DROP COLUMN IF EXISTS replacement_threshold"))
    conn.execute(text("ALTER TABLE road_assets DROP COLUMN IF EXISTS replacement_cost"))
    conn.execute(text("ALTER TABLE road_assets DROP COLUMN IF EXISTS expected_life_years"))
    conn.execute(text("ALTER TABLE road_assets DROP COLUMN IF EXISTS commissioning_year"))
    conn.execute(text("ALTER TABLE road_assets DROP COLUMN IF EXISTS criticality"))
