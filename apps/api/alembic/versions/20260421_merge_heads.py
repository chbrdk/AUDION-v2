"""Merge Alembic heads (single upgrade head).

Revision ID: 20260421_merge_heads
Revises: 20260421_ai_suggestion_cache, 20260416_journey_emotion_text, 20260211_image_url_text, 20251203_template_metadata
Create Date: 2026-04-21
"""

from __future__ import annotations


revision = "20260421_merge_heads"
down_revision = (
    "20260421_ai_suggestion_cache",
    "20260416_journey_emotion_text",
    "20260211_image_url_text",
    "20251203_template_metadata",
)
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Merge-only revision: no schema changes.
    pass


def downgrade() -> None:
    # Merge-only revision: no schema changes.
    pass

