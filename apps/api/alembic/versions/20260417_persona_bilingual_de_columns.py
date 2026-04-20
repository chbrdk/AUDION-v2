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


revision = "20260417_persona_bilingual_de"
down_revision = "20260417_persona_avatar_v2"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # IF NOT EXISTS: init_db.py (2d) may have added these before Alembic runs on legacy/stamped DBs.
    op.execute(
        sa.text("ALTER TABLE audion.personas ADD COLUMN IF NOT EXISTS headline_de TEXT NULL")
    )
    op.execute(
        sa.text("ALTER TABLE audion.personas ADD COLUMN IF NOT EXISTS profile_de JSONB NULL")
    )
    op.execute(
        sa.text("ALTER TABLE audion.personas ADD COLUMN IF NOT EXISTS profile_card_de JSONB NULL")
    )
    op.execute(
        sa.text(
            "ALTER TABLE audion.persona_prompts ADD COLUMN IF NOT EXISTS system_prompt_de TEXT NULL"
        )
    )


def downgrade() -> None:
    op.execute(
        sa.text("ALTER TABLE audion.persona_prompts DROP COLUMN IF EXISTS system_prompt_de")
    )
    op.execute(sa.text("ALTER TABLE audion.personas DROP COLUMN IF EXISTS profile_card_de"))
    op.execute(sa.text("ALTER TABLE audion.personas DROP COLUMN IF EXISTS profile_de"))
    op.execute(sa.text("ALTER TABLE audion.personas DROP COLUMN IF EXISTS headline_de"))
