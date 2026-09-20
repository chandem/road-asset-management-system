"""Add asset lifecycle inspection history and maintenance linkage.

Revision ID: 0006_asset_lifecycle
Revises: 0005_work_order_verification

Idempotent: baseline schema.sql may already include maintenance_activities.asset_id.
"""
from __future__ import annotations

from alembic import op
from sqlalchemy import text

revision = "0006_asset_lifecycle"
down_revision = "0005_work_order_verification"
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()
    conn.execute(text("SET search_path TO rams, public"))

    # Column may already exist from database/schema.sql baseline.
    conn.execute(text("""
        ALTER TABLE maintenance_activities
            ADD COLUMN IF NOT EXISTS asset_id BIGINT
    """))

    # FK / index: ignore if already present
    conn.execute(text("""
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM pg_constraint
                WHERE conname = 'fk_maintenance_asset'
                  AND conrelid = 'rams.maintenance_activities'::regclass
            ) THEN
                ALTER TABLE maintenance_activities
                    ADD CONSTRAINT fk_maintenance_asset
                    FOREIGN KEY (asset_id) REFERENCES road_assets(asset_id)
                    ON DELETE SET NULL;
            END IF;
        END $$;
    """))

    conn.execute(text("""
        CREATE INDEX IF NOT EXISTS idx_maintenance_asset
            ON maintenance_activities (asset_id)
    """))

    conn.execute(text("""
        CREATE TABLE IF NOT EXISTS asset_inspections (
            asset_inspection_id BIGSERIAL PRIMARY KEY,
            asset_id BIGINT NOT NULL
                REFERENCES road_assets(asset_id) ON DELETE CASCADE,
            inspection_date DATE NOT NULL,
            inspector_id BIGINT
                REFERENCES users(user_id) ON DELETE SET NULL,
            condition_rating NUMERIC(5, 2),
            defect_status VARCHAR(50),
            notes TEXT,
            CHECK (
                condition_rating IS NULL
                OR (condition_rating >= 0 AND condition_rating <= 100)
            )
        )
    """))

    conn.execute(text("""
        CREATE INDEX IF NOT EXISTS idx_asset_inspections_asset_date
            ON asset_inspections (asset_id, inspection_date)
    """))


def downgrade() -> None:
    conn = op.get_bind()
    conn.execute(text("SET search_path TO rams, public"))
    conn.execute(text("DROP INDEX IF EXISTS idx_asset_inspections_asset_date"))
    conn.execute(text("DROP TABLE IF EXISTS asset_inspections"))
    conn.execute(text("DROP INDEX IF EXISTS idx_maintenance_asset"))
    conn.execute(text("""
        ALTER TABLE maintenance_activities
            DROP CONSTRAINT IF EXISTS fk_maintenance_asset
    """))
    conn.execute(text("""
        ALTER TABLE maintenance_activities
            DROP COLUMN IF EXISTS asset_id
    """))
