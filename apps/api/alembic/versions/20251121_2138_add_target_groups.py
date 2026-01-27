from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "20251121_2138_add_target_groups"
down_revision = "20251120_02_persona_assets"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    # 1. Create target_groups table
    if not inspector.has_table("target_groups"):
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
    if not inspector.has_table("target_group_sources"):
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
    if not inspector.has_table("target_group_knowledge_entries"):
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
    existing_columns = [col['name'] for col in inspector.get_columns("personas")]
    if "target_group_id" not in existing_columns:
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
    # Use raw SQL with ON CONFLICT DO NOTHING to make it idempotent
    # Note: target_groups.id is UUID, randomly generated. So collision is unlikely, but logic needs care.
    # Since we select gen_random_uuid(), running this twice adds duplicates if constraints don't stop it.
    # We should only run this if target_groups is empty? 
    # Or, rely on the fact that if tables existed, this might have run already.
    # Safe check: if target_groups has data, assume migrated.
    
    # Simple check for emptiness:
    conn = op.get_bind()
    # Check if target_groups is empty
    # Handle cases where target_groups might not exist yet (if create_table failed/skipped above differently?)
    # But here we ensure it exists.
    try:
        result = conn.execute(sa.text("SELECT count(*) FROM target_groups")).scalar()
    except Exception:
        result = 0 # Fallback if table somehow missing but just created?

    if result == 0:
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


def downgrade() -> None:
    # 6. Revert target_group_id in personas (not needed, dropping column does it)
    
    # 4. Drop target_group_id from personas
    op.drop_column("personas", "target_group_id")

    # 3. Drop target_group_knowledge_entries table
    op.drop_table("target_group_knowledge_entries")

    # 2. Drop target_group_sources table
    op.drop_table("target_group_sources")

    # 1. Drop target_groups table
    op.drop_table("target_groups")
