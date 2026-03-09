"""Add tavus_replica_id and tavus_persona_id to audion.personas for Tavus video chat (CVI).

Revision ID: 20260309_tavus
Revises: 20260309_headline_text
Create Date: 2026-03-09

"""
from __future__ import annotations

from alembic import op

revision = "20260309_tavus"
down_revision = "20260309_headline_text"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("ALTER TABLE audion.personas ADD COLUMN IF NOT EXISTS tavus_replica_id VARCHAR(256) NULL")
    op.execute("ALTER TABLE audion.personas ADD COLUMN IF NOT EXISTS tavus_persona_id VARCHAR(256) NULL")


def downgrade() -> None:
    op.execute("ALTER TABLE audion.personas DROP COLUMN IF EXISTS tavus_replica_id")
    op.execute("ALTER TABLE audion.personas DROP COLUMN IF EXISTS tavus_persona_id")
