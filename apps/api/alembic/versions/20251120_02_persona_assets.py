from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "20251120_02_persona_assets"
down_revision = "20251120_01_persona_metadata"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "documents",
        sa.Column("object_key", sa.String(length=512), nullable=True),
    )
    op.add_column(
        "documents",
        sa.Column(
            "persona_id",
            sa.dialects.postgresql.UUID(as_uuid=True),
            sa.ForeignKey("personas.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )
    op.add_column(
        "documents",
        sa.Column("uploaded_by", sa.String(length=128), nullable=True),
    )
    op.add_column(
        "documents",
        sa.Column("insight_summary", sa.Text(), nullable=True),
    )

    op.create_table(
        "persona_knowledge_entries",
        sa.Column("id", sa.dialects.postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "persona_id",
            sa.dialects.postgresql.UUID(as_uuid=True),
            sa.ForeignKey("personas.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("title", sa.String(length=256), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("metadata", sa.JSON(), nullable=True),
        sa.Column("created_by", sa.String(length=128), nullable=False),
        sa.Column("created_at", sa.DateTime(), server_default=sa.text("now()"), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("persona_knowledge_entries")
    op.drop_column("documents", "insight_summary")
    op.drop_column("documents", "uploaded_by")
    op.drop_column("documents", "persona_id")
    op.drop_column("documents", "object_key")



