from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "20251122_0941_tg_doc"
down_revision = "20251121_2138_add_target_groups"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add target_group_id column to documents table
    op.add_column(
        "documents",
        sa.Column(
            "target_group_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("target_groups.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )


def downgrade() -> None:
    # Remove target_group_id column from documents table
    op.drop_column("documents", "target_group_id")

