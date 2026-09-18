"""Add work order verification table.

Revision ID: 0005_work_order_verification
Revises: 0004_work_order_execution
"""
from alembic import op

revision = "0005_work_order_verification"
down_revision = "0004_work_order_execution"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("""
        CREATE TABLE IF NOT EXISTS work_order_verifications (
            verification_id BIGSERIAL PRIMARY KEY,
            work_order_id BIGINT NOT NULL UNIQUE REFERENCES rams.work_orders(work_order_id) ON DELETE CASCADE,
            verified_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            verified_by VARCHAR(200) NOT NULL,
            result VARCHAR(30) NOT NULL DEFAULT 'accepted',
            completed_quantity NUMERIC(14,3),
            final_condition VARCHAR(50),
            gps_latitude DOUBLE PRECISION,
            gps_longitude DOUBLE PRECISION,
            remarks TEXT,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            CHECK (result IN ('accepted', 'accepted with observations', 'rejected')),
            CHECK (completed_quantity IS NULL OR completed_quantity >= 0),
            CHECK (gps_latitude IS NULL OR gps_latitude BETWEEN -90 AND 90),
            CHECK (gps_longitude IS NULL OR gps_longitude BETWEEN -180 AND 180)
        )
    """)


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS rams.work_order_verifications")
