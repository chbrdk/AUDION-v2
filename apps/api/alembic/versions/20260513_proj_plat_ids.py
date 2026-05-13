"""Add platform_project_id / platform_company_id to audion.projects.

Revision ID: 20260513_proj_plat_ids (<=32 chars for audion.alembic_version.version_num)
Revises: 20260512_plat_mgr_proj_mem
Create Date: 2026-05-13
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect


revision = "20260513_proj_plat_ids"
down_revision = "20260512_plat_mgr_proj_mem"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    insp = inspect(bind)
    cols = [c["name"] for c in insp.get_columns("projects", schema="audion")]
    if "platform_project_id" not in cols:
        op.add_column(
            "projects",
            sa.Column("platform_project_id", sa.String(length=64), nullable=True),
            schema="audion",
        )
    if "platform_company_id" not in cols:
        op.add_column(
            "projects",
            sa.Column("platform_company_id", sa.String(length=64), nullable=True),
            schema="audion",
        )
    indexes = insp.get_indexes("projects", schema="audion")
    names = {i["name"] for i in indexes}
    if "uq_audion_projects_platform_project_id" not in names:
        op.create_index(
            "uq_audion_projects_platform_project_id",
            "projects",
            ["platform_project_id"],
            unique=True,
            schema="audion",
        )


def downgrade() -> None:
    bind = op.get_bind()
    insp = inspect(bind)
    indexes = insp.get_indexes("projects", schema="audion")
    names = {i["name"] for i in indexes}
    if "uq_audion_projects_platform_project_id" in names:
        op.drop_index("uq_audion_projects_platform_project_id", table_name="projects", schema="audion")
    cols = [c["name"] for c in insp.get_columns("projects", schema="audion")]
    if "platform_company_id" in cols:
        op.drop_column("projects", "platform_company_id", schema="audion")
    if "platform_project_id" in cols:
        op.drop_column("projects", "platform_project_id", schema="audion")
