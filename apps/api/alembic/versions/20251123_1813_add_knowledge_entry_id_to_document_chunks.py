from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "20251123_1813_kg_entry"
down_revision = "20251122_0941_tg_doc"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add knowledge_entry_id column to document_chunks table
    op.add_column(
        "document_chunks",
        sa.Column(
            "knowledge_entry_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("target_group_knowledge_entries.id", ondelete="CASCADE"),
            nullable=True,
        ),
    )
    # Add index for better query performance
    op.create_index(
        "ix_document_chunks_knowledge_entry_id",
        "document_chunks",
        ["knowledge_entry_id"],
    )


def downgrade() -> None:
    # Remove index
    op.drop_index("ix_document_chunks_knowledge_entry_id", table_name="document_chunks")
    # Remove knowledge_entry_id column from document_chunks table
    op.drop_column("document_chunks", "knowledge_entry_id")

