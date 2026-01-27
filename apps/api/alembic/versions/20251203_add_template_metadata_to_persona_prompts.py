"""Add template_metadata to persona_prompts

Revision ID: 20251203_template_metadata
Revises: 20251128_add_deleted
Create Date: 2025-12-03 08:00:00.000000

"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision = "20251203_template_metadata"
down_revision = "20251128_add_deleted"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing_columns = [col['name'] for col in inspector.get_columns("persona_prompts")]
    
    if "template_metadata" not in existing_columns:
        op.add_column(
            "persona_prompts",
            sa.Column("template_metadata", postgresql.JSONB(astext_type=sa.Text()), nullable=True)
        )


def downgrade() -> None:
    op.drop_column("persona_prompts", "template_metadata")
