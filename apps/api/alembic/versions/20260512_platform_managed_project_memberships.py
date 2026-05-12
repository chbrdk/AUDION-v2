"""Add platform managed project memberships.

Revision ID: 20260512_platform_managed_project_memberships
Revises: 20260512_journeys_from_ux_runs
Create Date: 2026-05-12
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect
from sqlalchemy.dialects import postgresql


revision = "20260512_platform_managed_project_memberships"
down_revision = "20260512_journeys_from_ux_runs"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    insp = inspect(bind)
    tables = insp.get_table_names(schema="audion")

    if "platform_managed_project_memberships" not in tables:
        project_role_enum = postgresql.ENUM(
            "owner",
            "admin",
            "member",
            name="project_role",
            schema="audion",
            create_type=False,
        )
        op.create_table(
            "platform_managed_project_memberships",
            sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
            sa.Column("plexon_user_id", sa.String(length=128), nullable=False),
            sa.Column(
                "user_id",
                postgresql.UUID(as_uuid=True),
                sa.ForeignKey("audion.users.id", ondelete="CASCADE"),
                nullable=False,
            ),
            sa.Column(
                "project_id",
                postgresql.UUID(as_uuid=True),
                sa.ForeignKey("audion.projects.id", ondelete="CASCADE"),
                nullable=False,
            ),
            sa.Column("role", project_role_enum, nullable=False, server_default="member"),
            sa.Column("created_at", sa.DateTime(), server_default=sa.text("now()"), nullable=False),
            sa.Column("updated_at", sa.DateTime(), server_default=sa.text("now()"), nullable=False),
            sa.UniqueConstraint("user_id", "project_id", name="uq_platform_managed_project_membership"),
            schema="audion",
        )


def downgrade() -> None:
    bind = op.get_bind()
    insp = inspect(bind)
    tables = insp.get_table_names(schema="audion")
    if "platform_managed_project_memberships" in tables:
        op.drop_table("platform_managed_project_memberships", schema="audion")
