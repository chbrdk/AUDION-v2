"""personas headline VARCHAR(256) -> TEXT

Revision ID: 20260309_headline_text
Revises: 20260308_api_tokens
Create Date: 2026-03-09

Target-group persona generation uses payload.description as headline; AI or long
descriptions can exceed 256 chars and cause StringDataRightTruncation. Widen to TEXT.
"""
from __future__ import annotations

from alembic import op

revision = "20260309_headline_text"
down_revision = "20260308_api_tokens"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        "ALTER TABLE audion.personas ALTER COLUMN headline TYPE TEXT USING headline::TEXT"
    )


def downgrade() -> None:
    op.execute(
        "ALTER TABLE audion.personas ALTER COLUMN headline TYPE VARCHAR(256) "
        "USING (CASE WHEN length(headline) <= 256 THEN headline ELSE left(headline, 253) || '...' END)"
    )
