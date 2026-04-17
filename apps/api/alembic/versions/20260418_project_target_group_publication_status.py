"""Add draft/published lifecycle status for projects and target groups.

Revision ID: 20260418_proj_tg_pub_stat
Revises: 20260418_project_tg_bilingual_de
(Keep revision id length <= 32 chars for audion.alembic_version.version_num.)
Create Date: 2026-04-18

Existing rows default to `draft` so publish-time bilingual validation is opt-in.
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy import inspect


revision = "20260418_proj_tg_pub_stat"
down_revision = "20260418_project_tg_bilingual_de"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    insp = inspect(bind)
    proj_cols = {c["name"] for c in insp.get_columns("projects", schema="audion")}
    if "status" not in proj_cols:
        op.add_column(
            "projects",
            sa.Column("status", sa.String(length=32), nullable=False, server_default="draft"),
            schema="audion",
        )
        op.alter_column("projects", "status", server_default=None, schema="audion")
    tg_cols = {c["name"] for c in insp.get_columns("target_groups", schema="audion")}
    if "status" not in tg_cols:
        op.add_column(
            "target_groups",
            sa.Column("status", sa.String(length=32), nullable=False, server_default="draft"),
            schema="audion",
        )
        op.alter_column("target_groups", "status", server_default=None, schema="audion")


def downgrade() -> None:
    bind = op.get_bind()
    insp = inspect(bind)
    tg_cols = {c["name"] for c in insp.get_columns("target_groups", schema="audion")}
    if "status" in tg_cols:
        op.drop_column("target_groups", "status", schema="audion")
    proj_cols = {c["name"] for c in insp.get_columns("projects", schema="audion")}
    if "status" in proj_cols:
        op.drop_column("projects", "status", schema="audion")
