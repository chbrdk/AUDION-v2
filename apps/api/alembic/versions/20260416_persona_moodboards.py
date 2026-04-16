"""Add persona moodboards and tiles.

Revision ID: 20260416_moodboards
Revises: 20260309_company_ctx
Create Date: 2026-04-16

"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "20260416_moodboards"
down_revision = "20260309_company_ctx"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # audion schema is on search_path in env.py
    # Idempotency: some environments may pre-create enum types during bootstrap.
    # Race-safe enum creation: some bootstraps run migrations concurrently.
    # Postgres does not support CREATE TYPE IF NOT EXISTS for enums; handle duplicate_object.
    op.execute(
        """
        DO $$
        BEGIN
            CREATE TYPE moodboard_status AS ENUM ('draft', 'building', 'ready', 'failed');
        EXCEPTION
            WHEN duplicate_object THEN
                NULL;
        END$$;
        """
    )
    moodboard_status_enum = sa.Enum(
        "draft",
        "building",
        "ready",
        "failed",
        name="moodboard_status",
        create_type=False,
    )
    op.create_table(
        "persona_moodboards",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "persona_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("audion.personas.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("project_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("title", sa.String(length=256), nullable=False, server_default="Moodboard"),
        sa.Column(
            "status",
            moodboard_status_enum,
            nullable=False,
            server_default="draft",
        ),
        sa.Column("active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("style_keywords", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_by", sa.String(length=128), nullable=True),
    )
    op.create_index("ix_persona_moodboards_persona_id", "persona_moodboards", ["persona_id"])
    # One active moodboard per persona (allow multiple inactive boards for history).
    op.create_index(
        "uq_persona_moodboards_active_per_persona",
        "persona_moodboards",
        ["persona_id"],
        unique=True,
        postgresql_where=sa.text("active IS TRUE"),
    )

    op.create_table(
        "persona_moodboard_tiles",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "moodboard_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("audion.persona_moodboards.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("category", sa.String(length=64), nullable=False),
        sa.Column("image_url", sa.Text(), nullable=False),
        sa.Column("thumb_url", sa.Text(), nullable=True),
        sa.Column("source_type", sa.String(length=64), nullable=False, server_default="openverse"),
        sa.Column("source_url", sa.Text(), nullable=True),
        sa.Column("author", sa.String(length=256), nullable=True),
        sa.Column("license", sa.String(length=256), nullable=True),
        sa.Column("attribution_text", sa.Text(), nullable=True),
        sa.Column("caption", sa.Text(), nullable=True),
        sa.Column("rationale", sa.Text(), nullable=True),
        sa.Column("tags", sa.JSON(), nullable=True),
        sa.Column("tile_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("locked", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("created_at", sa.DateTime(), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_persona_moodboard_tiles_moodboard_id", "persona_moodboard_tiles", ["moodboard_id"])
    op.create_index("ix_persona_moodboard_tiles_order", "persona_moodboard_tiles", ["moodboard_id", "tile_order"])


def downgrade() -> None:
    op.drop_index("ix_persona_moodboard_tiles_order", table_name="persona_moodboard_tiles")
    op.drop_index("ix_persona_moodboard_tiles_moodboard_id", table_name="persona_moodboard_tiles")
    op.drop_table("persona_moodboard_tiles")

    op.drop_index("uq_persona_moodboards_active_per_persona", table_name="persona_moodboards")
    op.drop_index("ix_persona_moodboards_persona_id", table_name="persona_moodboards")
    op.drop_table("persona_moodboards")
    # Only drop the type if nothing else depends on it.
    op.execute("DROP TYPE IF EXISTS moodboard_status")

