"""Add German mirror columns for projects and target groups (EN canonical).

Revision ID: 20260418_project_tg_bilingual_de
Revises: 20260417_persona_bilingual_de
Create Date: 2026-04-18

English remains canonical in existing columns:
- projects.name, projects.description, projects.company_context
- target_groups.name, target_groups.segment, target_groups.description

German mirrors are optional (nullable) for gradual rollout.
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op


revision = "20260418_project_tg_bilingual_de"
down_revision = "20260417_persona_bilingual_de"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # IF NOT EXISTS: init_db.py (2c) may have added these on legacy DBs before this revision runs.
    op.execute(
        sa.text("ALTER TABLE audion.projects ADD COLUMN IF NOT EXISTS name_de VARCHAR(128) NULL")
    )
    op.execute(
        sa.text("ALTER TABLE audion.projects ADD COLUMN IF NOT EXISTS description_de TEXT NULL")
    )
    op.execute(
        sa.text(
            "ALTER TABLE audion.projects ADD COLUMN IF NOT EXISTS company_context_de TEXT NULL"
        )
    )
    op.execute(
        sa.text(
            "ALTER TABLE audion.target_groups ADD COLUMN IF NOT EXISTS name_de VARCHAR(128) NULL"
        )
    )
    op.execute(
        sa.text(
            "ALTER TABLE audion.target_groups ADD COLUMN IF NOT EXISTS segment_de VARCHAR(128) NULL"
        )
    )
    op.execute(
        sa.text(
            "ALTER TABLE audion.target_groups ADD COLUMN IF NOT EXISTS description_de TEXT NULL"
        )
    )


def downgrade() -> None:
    op.execute(sa.text("ALTER TABLE audion.target_groups DROP COLUMN IF EXISTS description_de"))
    op.execute(sa.text("ALTER TABLE audion.target_groups DROP COLUMN IF EXISTS segment_de"))
    op.execute(sa.text("ALTER TABLE audion.target_groups DROP COLUMN IF EXISTS name_de"))
    op.execute(sa.text("ALTER TABLE audion.projects DROP COLUMN IF EXISTS company_context_de"))
    op.execute(sa.text("ALTER TABLE audion.projects DROP COLUMN IF EXISTS description_de"))
    op.execute(sa.text("ALTER TABLE audion.projects DROP COLUMN IF EXISTS name_de"))
