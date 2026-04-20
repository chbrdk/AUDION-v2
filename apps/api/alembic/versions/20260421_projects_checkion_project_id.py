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
    # IF NOT EXISTS: init_db may add this column before Alembic runs; plain add_column would fail.
    op.execute(
        sa.text(
            "ALTER TABLE audion.projects ADD COLUMN IF NOT EXISTS checkion_project_id VARCHAR(40) NULL"
        )
    )


def downgrade() -> None:
    op.execute(sa.text("ALTER TABLE audion.projects DROP COLUMN IF EXISTS checkion_project_id"))
