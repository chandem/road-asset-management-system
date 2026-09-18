"""Add asset replacement planning fields.

Revision ID: 0008_asset_replacement_planning
Revises: 0007_asset_defect_link
"""

from alembic import op
import sqlalchemy as sa


revision = "0008_asset_replacement_planning"
down_revision = "0007_asset_defect_link"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("road_assets", sa.Column("criticality", sa.Integer(), nullable=False, server_default="3"), schema="rams")
    op.add_column("road_assets", sa.Column("commissioning_year", sa.Integer(), nullable=True), schema="rams")
    op.add_column("road_assets", sa.Column("expected_life_years", sa.Integer(), nullable=True), schema="rams")
    op.add_column("road_assets", sa.Column("replacement_cost", sa.Numeric(14, 2), nullable=True), schema="rams")
    op.add_column("road_assets", sa.Column("replacement_threshold", sa.Numeric(5, 2), nullable=False, server_default="40"), schema="rams")
    op.create_check_constraint("ck_road_assets_criticality", "road_assets", "criticality BETWEEN 1 AND 5", schema="rams")
    op.create_check_constraint("ck_road_assets_expected_life", "road_assets", "expected_life_years IS NULL OR expected_life_years >= 1", schema="rams")
    op.create_check_constraint("ck_road_assets_replacement_cost", "road_assets", "replacement_cost IS NULL OR replacement_cost >= 0", schema="rams")
    op.create_check_constraint("ck_road_assets_replacement_threshold", "road_assets", "replacement_threshold BETWEEN 0 AND 100", schema="rams")


def downgrade() -> None:
    op.drop_constraint("ck_road_assets_replacement_threshold", "road_assets", schema="rams", type_="check")
    op.drop_constraint("ck_road_assets_replacement_cost", "road_assets", schema="rams", type_="check")
    op.drop_constraint("ck_road_assets_expected_life", "road_assets", schema="rams", type_="check")
    op.drop_constraint("ck_road_assets_criticality", "road_assets", schema="rams", type_="check")
    op.drop_column("road_assets", "replacement_threshold", schema="rams")
    op.drop_column("road_assets", "replacement_cost", schema="rams")
    op.drop_column("road_assets", "expected_life_years", schema="rams")
    op.drop_column("road_assets", "commissioning_year", schema="rams")
    op.drop_column("road_assets", "criticality", schema="rams")
