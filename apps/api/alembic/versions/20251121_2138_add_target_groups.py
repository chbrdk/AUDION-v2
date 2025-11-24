from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "20251121_2138_add_target_groups"
down_revision = "20251120_02_persona_assets"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. Create target_groups table
    op.create_table(
        "target_groups",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("project_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(length=128), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("segment", sa.String(length=128), nullable=False),
        sa.Column("created_at", sa.DateTime(), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_by", sa.String(length=128), nullable=True),
    )

    # 2. Create target_group_sources table
    op.create_table(
        "target_group_sources",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "target_group_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("target_groups.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "chunk_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("document_chunks.id"),
            nullable=False,
        ),
        sa.Column("relevance_score", sa.Float(), nullable=False, server_default="1.0"),
        sa.Column("rationale", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.text("now()"), nullable=False),
    )

    # 3. Create target_group_knowledge_entries table
    op.create_table(
        "target_group_knowledge_entries",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "target_group_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("target_groups.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("title", sa.String(length=256), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("metadata", sa.JSON(), nullable=True),
        sa.Column("created_by", sa.String(length=128), nullable=False),
        sa.Column("created_at", sa.DateTime(), server_default=sa.text("now()"), nullable=False),
    )

    # 4. Add target_group_id to personas (nullable für Migration)
    op.add_column(
        "personas",
        sa.Column(
            "target_group_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("target_groups.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )

    # 5. MIGRATION: Erstelle Target Groups aus existierenden Persona Segmenten
    # Für jeden unique segment in personas, erstelle ein Target Group
    op.execute("""
        INSERT INTO target_groups (id, project_id, name, description, segment, created_at, updated_at)
        SELECT 
            gen_random_uuid() as id,
            p.project_id,
            p.segment as name,
            'Migrated from persona segment' as description,
            p.segment,
            MIN(p.created_at) as created_at,
            MAX(p.updated_at) as updated_at
        FROM personas p
        GROUP BY p.segment, p.project_id
    """)

    # 6. MIGRATION: Setze target_group_id in personas basierend auf segment
    op.execute("""
        UPDATE personas p
        SET target_group_id = tg.id
        FROM target_groups tg
        WHERE p.segment = tg.segment AND p.project_id = tg.project_id
    """)

    # 7. MIGRATION: Migriere PersonaSource -> TargetGroupSource
    # PersonaSource hat kein created_at Feld, verwende now()
    op.execute("""
        INSERT INTO target_group_sources (id, target_group_id, chunk_id, relevance_score, rationale, created_at)
        SELECT 
            gen_random_uuid() as id,
            p.target_group_id,
            ps.chunk_id,
            ps.confidence as relevance_score,
            ps.rationale,
            now() as created_at
        FROM persona_sources ps
        JOIN personas p ON ps.persona_id = p.id
        WHERE p.target_group_id IS NOT NULL
    """)

    # 8. MIGRATION: Migriere PersonaKnowledgeEntry -> TargetGroupKnowledgeEntry
    op.execute("""
        INSERT INTO target_group_knowledge_entries (id, target_group_id, title, content, metadata, created_by, created_at)
        SELECT 
            gen_random_uuid() as id,
            p.target_group_id,
            pke.title,
            pke.content,
            pke.metadata,
            pke.created_by,
            pke.created_at
        FROM persona_knowledge_entries pke
        JOIN personas p ON pke.persona_id = p.id
        WHERE p.target_group_id IS NOT NULL
    """)


def downgrade() -> None:
    # Reverse order
    op.drop_column("personas", "target_group_id")
    op.drop_table("target_group_knowledge_entries")
    op.drop_table("target_group_sources")
    op.drop_table("target_groups")

