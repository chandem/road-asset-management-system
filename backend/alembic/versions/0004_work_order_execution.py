"""add work order execution tracking

Revision ID: 0004
Revises: 0003_offline_defects
"""

from alembic import op
import sqlalchemy as sa


revision = "0004"
down_revision = "0003"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "work_order_executions",
        sa.Column("execution_id", sa.BigInteger(), primary_key=True),
        sa.Column("work_order_id", sa.BigInteger(), sa.ForeignKey("rams.work_orders.work_order_id", ondelete="CASCADE"), nullable=False, unique=True),
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
