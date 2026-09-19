"""Repair missing core authentication tables.

Revision ID: 0009_repair_auth_tables
Revises: 0008_asset_replacement_planning
"""

from alembic import op
import sqlalchemy as sa


revision = "0009_repair_auth_tables"
down_revision = "0008_asset_replacement_planning"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Some existing RAMS databases were initialized with a partial schema
    # where rams.roads existed but rams.users did not. The original baseline
    # migration used the presence of roads as its skip condition, so repair
    # the authentication tables explicitly.
    op.execute(
        """
        CREATE SCHEMA IF NOT EXISTS rams;

        CREATE TABLE IF NOT EXISTS rams.organizations (
            organization_id BIGSERIAL PRIMARY KEY,
            name VARCHAR(200) NOT NULL,
            code VARCHAR(50) UNIQUE,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS rams.users (
            user_id BIGSERIAL PRIMARY KEY,
            organization_id BIGINT REFERENCES rams.organizations(organization_id) ON DELETE SET NULL,
            username VARCHAR(100) NOT NULL UNIQUE,
            full_name VARCHAR(200) NOT NULL,
            email VARCHAR(255) UNIQUE,
            role VARCHAR(50) NOT NULL DEFAULT 'inspector',
            is_active BOOLEAN NOT NULL DEFAULT TRUE,
            password_hash VARCHAR(255),
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );

        CREATE INDEX IF NOT EXISTS idx_users_username
        ON rams.users (username);
        """
    )


def downgrade() -> None:
    # Do not drop authentication tables during normal migration rollback;
    # they may contain production user data.
    pass
