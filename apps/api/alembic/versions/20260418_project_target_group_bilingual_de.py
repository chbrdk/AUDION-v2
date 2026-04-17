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
    op.add_column(
        "projects",
        sa.Column("name_de", sa.String(length=128), nullable=True),
        schema="audion",
    )
    op.add_column(
        "projects",
        sa.Column("description_de", sa.Text(), nullable=True),
        schema="audion",
    )
    op.add_column(
        "projects",
        sa.Column("company_context_de", sa.Text(), nullable=True),
        schema="audion",
    )

    op.add_column(
        "target_groups",
        sa.Column("name_de", sa.String(length=128), nullable=True),
        schema="audion",
    )
    op.add_column(
        "target_groups",
        sa.Column("segment_de", sa.String(length=128), nullable=True),
        schema="audion",
    )
    op.add_column(
        "target_groups",
        sa.Column("description_de", sa.Text(), nullable=True),
        schema="audion",
    )


def downgrade() -> None:
    op.drop_column("target_groups", "description_de", schema="audion")
    op.drop_column("target_groups", "segment_de", schema="audion")
    op.drop_column("target_groups", "name_de", schema="audion")
    op.drop_column("projects", "company_context_de", schema="audion")
    op.drop_column("projects", "description_de", schema="audion")
    op.drop_column("projects", "name_de", schema="audion")
