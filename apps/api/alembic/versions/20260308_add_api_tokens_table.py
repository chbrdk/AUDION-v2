"""add api_tokens table for Bearer API token auth (MCP, integrations)

Revision ID: 20260308_api_tokens
Revises: 20260302_plexon_user_id
Create Date: 2026-03-08

"""
from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "20260308_api_tokens"
down_revision = "20260302_plexon_user_id"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if not inspector.has_table("api_tokens", schema="audion"):
        op.create_table(
            "api_tokens",
            sa.Column("id", sa.UUID(), nullable=False),
            sa.Column("user_id", sa.UUID(), nullable=False),
            sa.Column("token_hash", sa.String(length=64), nullable=False),
            sa.Column("name", sa.String(length=256), nullable=True),
            sa.Column("created_at", sa.DateTime(), nullable=False),
            sa.PrimaryKeyConstraint("id"),
            sa.ForeignKeyConstraint(
                ["user_id"],
                ["audion.users.id"],
                ondelete="CASCADE",
            ),
            schema="audion",
        )


def downgrade() -> None:
    op.drop_table("api_tokens", schema="audion")
