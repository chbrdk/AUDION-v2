"""add user profile fields

Revision ID: 20260209_user_profile_fields
Revises: 20260209_auth_projects
Create Date: 2026-02-09 16:00:00.000000
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "20260209_user_profile_fields"
down_revision = "20260209_auth_projects"
branch_labels = None
depends_on = None


def _column_exists(inspector: sa.Inspector, table: str, column: str, schema: str = "audion") -> bool:
    if not inspector.has_table(table, schema=schema):
        return False
    return any(col["name"] == column for col in inspector.get_columns(table, schema=schema))


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if not _column_exists(inspector, "users", "company"):
        op.add_column("users", sa.Column("company", sa.String(length=256), nullable=True), schema="audion")
    if not _column_exists(inspector, "users", "avatar_url"):
        op.add_column("users", sa.Column("avatar_url", sa.String(length=512), nullable=True), schema="audion")
    if not _column_exists(inspector, "users", "locale"):
        op.add_column("users", sa.Column("locale", sa.String(length=8), nullable=True), schema="audion")


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if _column_exists(inspector, "users", "locale"):
        op.drop_column("users", "locale", schema="audion")
    if _column_exists(inspector, "users", "avatar_url"):
        op.drop_column("users", "avatar_url", schema="audion")
    if _column_exists(inspector, "users", "company"):
        op.drop_column("users", "company", schema="audion")
