"""Add asset lifecycle inspection history and maintenance linkage."""
from alembic import op
import sqlalchemy as sa
revision = "0006_asset_lifecycle"
down_revision = "0005_work_order_verification"
branch_labels = None
depends_on = None

def upgrade():
    op.add_column("maintenance_activities", sa.Column("asset_id", sa.BigInteger(), nullable=True), schema="rams")
    op.create_foreign_key("fk_maintenance_asset", "maintenance_activities", "road_assets", ["asset_id"], ["asset_id"], source_schema="rams", referent_schema="rams", ondelete="SET NULL")
    op.create_index("idx_maintenance_asset", "maintenance_activities", ["asset_id"], schema="rams")
    op.create_table("asset_inspections",
        sa.Column("asset_inspection_id", sa.BigInteger(), primary_key=True),
        sa.Column("asset_id", sa.BigInteger(), sa.ForeignKey("rams.road_assets.asset_id", ondelete="CASCADE"), nullable=False),
        sa.Column("inspection_date", sa.Date(), nullable=False),
        sa.Column("inspector_id", sa.BigInteger(), sa.ForeignKey("rams.users.user_id", ondelete="SET NULL")),
        sa.Column("condition_rating", sa.Numeric(5,2)), sa.Column("defect_status", sa.String(50)), sa.Column("notes", sa.Text()),
        sa.CheckConstraint("condition_rating IS NULL OR (condition_rating >= 0 AND condition_rating <= 100)", name="ck_asset_inspection_condition"), schema="rams")
    op.create_index("idx_asset_inspections_asset_date", "asset_inspections", ["asset_id", "inspection_date"], schema="rams")

def downgrade():
    op.drop_index("idx_asset_inspections_asset_date", table_name="asset_inspections", schema="rams")
    op.drop_table("asset_inspections", schema="rams")
    op.drop_index("idx_maintenance_asset", table_name="maintenance_activities", schema="rams")
    op.drop_constraint("fk_maintenance_asset", "maintenance_activities", schema="rams", type_="foreignkey")
    op.drop_column("maintenance_activities", "asset_id", schema="rams")
