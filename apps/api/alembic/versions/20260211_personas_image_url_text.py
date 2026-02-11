"""personas image_url to TEXT for generated avatars (data URLs)

Revision ID: 20260211_image_url_text
Revises: 20260209_user_profile_fields
Create Date: 2026-02-11 12:00:00.000000

Avatar generation (chat-api) stores base64 data URLs when no S3/storage is
configured; these exceed VARCHAR(512). Widen to TEXT so they can be persisted.
"""
from __future__ import annotations

from alembic import op


revision = "20260211_image_url_text"
down_revision = "20260209_user_profile_fields"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Allow long image_url (e.g. data:image/png;base64,... from avatar generation)
    op.execute("ALTER TABLE audion.personas ALTER COLUMN image_url TYPE TEXT USING image_url::TEXT")


def downgrade() -> None:
    # Reverting may truncate existing long URLs; only safe if no data URLs stored
    op.execute(
        "ALTER TABLE audion.personas ALTER COLUMN image_url TYPE VARCHAR(512) "
        "USING (CASE WHEN length(image_url) <= 512 THEN image_url ELSE left(image_url, 509) || '...' END)"
    )
