"""add work order execution tracking

Revision ID: 0004_work_order_execution
Revises: 0003_offline_defects
"""

from alembic import op
import sqlalchemy as sa


revision = "0004_work_order_execution"
down_revision = "0003_offline_defects"
branch_labels = None
depends_on = None


def upgrade():
    # Some existing RAMS databases contain the baseline road tables but are
    # missing later core tables. Ensure the parent table exists before adding
    # the execution foreign key.
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS rams.work_orders (
            work_order_id BIGSERIAL PRIMARY KEY,
            maintenance_id BIGINT NOT NULL
                REFERENCES rams.maintenance_activities(maintenance_id)
                ON DELETE CASCADE,
            order_number VARCHAR(100) NOT NULL UNIQUE,
            issue_date DATE NOT NULL,
            due_date DATE,
            status VARCHAR(30) NOT NULL DEFAULT 'draft',
            assigned_to VARCHAR(200),
            instructions TEXT,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
        """
    )

    op.execute(
        """
        CREATE INDEX IF NOT EXISTS idx_work_orders_maintenance
        ON rams.work_orders (maintenance_id)
        """
    )
    op.execute(
        """
        CREATE INDEX IF NOT EXISTS idx_work_orders_status
        ON rams.work_orders (status)
        """
    )

    op.create_table(
        "work_order_executions",
        sa.Column("execution_id", sa.BigInteger(), primary_key=True),
        sa.Column(
            "work_order_id",
            sa.BigInteger(),
            sa.ForeignKey(
                "rams.work_orders.work_order_id",
                ondelete="CASCADE",
            ),
            nullable=False,
            unique=True,
        ),
        sa.Column("started_at", sa.DateTime(timezone=True)),
        sa.Column("completed_at", sa.DateTime(timezone=True)),
        sa.Column("crew", sa.Text()),
        sa.Column("equipment", sa.Text()),
        sa.Column("materials", sa.Text()),
        sa.Column("planned_quantity", sa.Numeric(14, 3)),
        sa.Column("actual_quantity", sa.Numeric(14, 3)),
        sa.Column("quantity_unit", sa.String(50)),
        sa.Column("actual_cost", sa.Numeric(14, 2)),
        sa.Column("gps_latitude", sa.Float()),
        sa.Column("gps_longitude", sa.Float()),
        sa.Column("notes", sa.Text()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )


def downgrade():
    op.drop_table("work_order_executions")
