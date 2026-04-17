"""Add German mirror columns for bilingual personas (EN remains canonical).

Revision ID: 20260417_persona_bilingual_de
Revises: 20260417_persona_avatar_v2
Create Date: 2026-04-17

English remains the source of truth in existing columns:
- personas.headline, personas.profile, personas.profile_card (when present)
- persona_prompts.system_prompt

German mirrors are optional until publish validation enforces completeness.
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "20260417_persona_bilingual_de"
down_revision = "20260417_persona_avatar_v2"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "personas",
        sa.Column("headline_de", sa.Text(), nullable=True),
        schema="audion",
    )
    op.add_column(
        "personas",
        sa.Column("profile_de", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        schema="audion",
    )
    op.add_column(
        "personas",
        sa.Column("profile_card_de", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        schema="audion",
    )
    op.add_column(
        "persona_prompts",
        sa.Column("system_prompt_de", sa.Text(), nullable=True),
        schema="audion",
    )


def downgrade() -> None:
    op.drop_column("persona_prompts", "system_prompt_de", schema="audion")
    op.drop_column("personas", "profile_card_de", schema="audion")
    op.drop_column("personas", "profile_de", schema="audion")
    op.drop_column("personas", "headline_de", schema="audion")
