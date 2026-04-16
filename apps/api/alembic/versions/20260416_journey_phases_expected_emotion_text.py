"""Widen journey_phases.expected_emotion for AI-generated prose.

Revision ID: 20260416_journey_emotion_text
Revises: 20260416_moodboards
Create Date: 2026-04-16

PostgreSQL previously used VARCHAR(64); generation can return full sentences.
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "20260416_journey_emotion_text"
down_revision = "20260416_moodboards"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.alter_column(
        "journey_phases",
        "expected_emotion",
        schema="audion",
        existing_type=sa.String(64),
        type_=sa.Text(),
        existing_nullable=True,
    )


def downgrade() -> None:
    op.execute(
        """
        UPDATE audion.journey_phases
        SET expected_emotion = LEFT(expected_emotion, 64)
        WHERE expected_emotion IS NOT NULL AND char_length(expected_emotion) > 64
        """
    )
    op.alter_column(
        "journey_phases",
        "expected_emotion",
        schema="audion",
        existing_type=sa.Text(),
        type_=sa.String(64),
        existing_nullable=True,
    )
