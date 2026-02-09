"""add users, projects, memberships, and ai template overrides

Revision ID: 20260209_auth_projects
Revises: 20260127_fix_obj_key
Create Date: 2026-02-09 09:00:00.000000
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision = "20260209_auth_projects"
down_revision = "20260127_fix_obj_key"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    project_role_enum = sa.Enum("owner", "admin", "member", name="project_role")
    project_member_status_enum = sa.Enum("active", "invited", name="project_member_status")
    project_role_enum.create(bind, checkfirst=True)
    project_member_status_enum.create(bind, checkfirst=True)

    if not inspector.has_table("users"):
        op.create_table(
            "users",
            sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
            sa.Column("email", sa.String(length=256), nullable=False, unique=True),
            sa.Column("password_hash", sa.String(length=256), nullable=False),
            sa.Column("name", sa.String(length=128), nullable=True),
            sa.Column("created_at", sa.DateTime(), server_default=sa.text("now()"), nullable=False),
            sa.Column("updated_at", sa.DateTime(), server_default=sa.text("now()"), nullable=False),
            sa.Column("last_login_at", sa.DateTime(), nullable=True),
        )

    if not inspector.has_table("projects"):
        op.create_table(
            "projects",
            sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
            sa.Column("name", sa.String(length=128), nullable=False),
            sa.Column("owner_user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
            sa.Column("created_at", sa.DateTime(), server_default=sa.text("now()"), nullable=False),
            sa.Column("updated_at", sa.DateTime(), server_default=sa.text("now()"), nullable=False),
        )

    if not inspector.has_table("project_members"):
        op.create_table(
            "project_members",
            sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
            sa.Column("project_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("projects.id", ondelete="CASCADE"), nullable=False),
            sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
            sa.Column("role", project_role_enum, nullable=False, server_default="member"),
            sa.Column("status", project_member_status_enum, nullable=False, server_default="active"),
            sa.Column("created_at", sa.DateTime(), server_default=sa.text("now()"), nullable=False),
            sa.Column("updated_at", sa.DateTime(), server_default=sa.text("now()"), nullable=False),
            sa.UniqueConstraint("project_id", "user_id", name="uq_project_member"),
        )

    if not inspector.has_table("ai_template_overrides"):
        op.create_table(
            "ai_template_overrides",
            sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
            sa.Column("project_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("projects.id", ondelete="CASCADE"), nullable=False),
            sa.Column("template_id", sa.String(length=128), nullable=False),
            sa.Column("payload", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
            sa.Column("updated_at", sa.DateTime(), server_default=sa.text("now()"), nullable=False),
            sa.Column("updated_by", sa.String(length=128), nullable=True),
            sa.UniqueConstraint("project_id", "template_id", name="uq_ai_template_override"),
        )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if inspector.has_table("ai_template_overrides"):
        op.drop_table("ai_template_overrides")
    if inspector.has_table("project_members"):
        op.drop_table("project_members")
    if inspector.has_table("projects"):
        op.drop_table("projects")
    if inspector.has_table("users"):
        op.drop_table("users")

    op.execute("DROP TYPE IF EXISTS project_member_status")
    op.execute("DROP TYPE IF EXISTS project_role")
