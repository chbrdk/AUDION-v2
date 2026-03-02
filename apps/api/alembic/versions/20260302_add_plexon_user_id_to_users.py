"""add plexon_user_id to users for PLEXON profile sync

Revision ID: 20260302_plexon_user_id
Revises: 20260211_image_url_text
Create Date: 2026-03-02

"""
from __future__ import annotations

import sqlalchemy as sa
from alembic import op


revision = "20260302_plexon_user_id"
down_revision = "20260211_image_url_text"
branch_labels = None
depends_on = None


def _column_exists(inspector: sa.Inspector, table: str, column: str, schema: str = "audion") -> bool:
    if not inspector.has_table(table, schema=schema):
        return False
    return any(col["name"] == column for col in inspector.get_columns(table, schema=schema))


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if not _column_exists(inspector, "users", "plexon_user_id"):
        op.add_column(
            "users",
            sa.Column("plexon_user_id", sa.String(length=128), nullable=True),
            schema="audion",
        )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if _column_exists(inspector, "users", "plexon_user_id"):
        op.drop_column("users", "plexon_user_id", schema="audion")
