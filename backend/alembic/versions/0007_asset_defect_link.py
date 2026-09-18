"""Link road defects to assets.

Revision ID: 0007_asset_defect_link
Revises: 0006_asset_lifecycle
"""

from alembic import op
import sqlalchemy as sa


revision = "0007_asset_defect_link"
down_revision = "0006_asset_lifecycle"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "road_defects",
        sa.Column("asset_id", sa.BigInteger(), nullable=True),
        schema="rams",
    )
    op.create_foreign_key(
        "fk_road_defects_asset_id",
        "road_defects",
        "road_assets",
        ["asset_id"],
        ["asset_id"],
        source_schema="rams",
        referent_schema="rams",
        ondelete="SET NULL",
    )
    op.create_index(
        "idx_road_defects_asset",
        "road_defects",
        ["asset_id"],
        schema="rams",
    )


def downgrade() -> None:
    op.drop_index("idx_road_defects_asset", table_name="road_defects", schema="rams")
    op.drop_constraint(
        "fk_road_defects_asset_id",
        "road_defects",
        schema="rams",
        type_="foreignkey",
    )
    op.drop_column("road_defects", "asset_id", schema="rams")
