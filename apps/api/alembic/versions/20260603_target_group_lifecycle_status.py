"""Target groups: draft/published → active/archived lifecycle.

Revision ID: 20260603_tg_lifecycle
Revises: 20260513_proj_plat_ids
Create Date: 2026-06-03
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "20260603_tg_lifecycle"
down_revision = "20260513_proj_plat_ids"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        sa.text(
            """
            UPDATE audion.target_groups
            SET status = 'active'
            WHERE status IS NULL OR status IN ('draft', 'published')
            """
        )
    )
    op.alter_column(
        "target_groups",
        "status",
        server_default="active",
        schema="audion",
    )


def downgrade() -> None:
    op.execute(
        sa.text(
            """
            UPDATE audion.target_groups
            SET status = 'draft'
            WHERE status = 'active'
            """
        )
    )
    op.execute(
        sa.text(
            """
            UPDATE audion.target_groups
            SET status = 'published'
            WHERE status = 'archived'
            """
        )
    )
    op.alter_column(
        "target_groups",
        "status",
        server_default="draft",
        schema="audion",
    )
