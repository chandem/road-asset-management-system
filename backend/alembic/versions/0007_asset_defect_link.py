"""Link road defects to assets.

Revision ID: 0007_asset_defect_link
Revises: 0006_asset_lifecycle

Idempotent: baseline schema.sql may already include road_defects.asset_id.
"""
from __future__ import annotations

from alembic import op
from sqlalchemy import text

revision = "0007_asset_defect_link"
down_revision = "0006_asset_lifecycle"
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()
    conn.execute(text("SET search_path TO rams, public"))

    conn.execute(text("""
        ALTER TABLE road_defects
            ADD COLUMN IF NOT EXISTS asset_id BIGINT
    """))

    conn.execute(text("""
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM pg_constraint
                WHERE conname = 'fk_road_defects_asset_id'
                  AND conrelid = 'rams.road_defects'::regclass
            ) THEN
                ALTER TABLE road_defects
                    ADD CONSTRAINT fk_road_defects_asset_id
                    FOREIGN KEY (asset_id) REFERENCES road_assets(asset_id)
                    ON DELETE SET NULL;
            END IF;
        END $$;
    """))

    conn.execute(text("""
        CREATE INDEX IF NOT EXISTS idx_road_defects_asset
            ON road_defects (asset_id)
    """))


def downgrade() -> None:
    conn = op.get_bind()
    conn.execute(text("SET search_path TO rams, public"))
    conn.execute(text("DROP INDEX IF EXISTS idx_road_defects_asset"))
    conn.execute(text("""
        ALTER TABLE road_defects
            DROP CONSTRAINT IF EXISTS fk_road_defects_asset_id
    """))
    conn.execute(text("""
        ALTER TABLE road_defects
            DROP COLUMN IF EXISTS asset_id
    """))
