"""Add deleted to persona_audit_action enum

Revision ID: 20251128_add_deleted
Revises: 20251126_1749
Create Date: 2025-11-28 20:56:00.000000

"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision = "20251128_add_deleted"
down_revision = "20251126_1749_journey_mapper"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add 'deleted' value to persona_audit_action enum
    op.execute("ALTER TYPE persona_audit_action ADD VALUE IF NOT EXISTS 'deleted'")


def downgrade() -> None:
    # Note: PostgreSQL doesn't support removing enum values directly
    # This would require recreating the enum type, which is complex
    # For now, we'll leave the value in place
    pass


