"""Optional CHECKION project id on audion.projects for Deep Scan linkage.

Revision ID: 20260421_chk_proj_id
Revises: 20260420_proj_ai_evt_seq
Create Date: 2026-04-21
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "20260421_chk_proj_id"
down_revision = "20260420_proj_ai_evt_seq"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "projects",
        sa.Column("checkion_project_id", sa.String(length=40), nullable=True),
        schema="audion",
    )


def downgrade() -> None:
    op.drop_column("projects", "checkion_project_id", schema="audion")
