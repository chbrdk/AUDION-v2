"""ai suggestion cache table

Revision ID: 20260421_ai_suggestion_cache
Revises: 20260421_projects_checkion_project_id
Create Date: 2026-04-21
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision = "20260421_ai_suggestion_cache"
down_revision = "20260421_chk_proj_id"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)
    if inspector.has_table("ai_suggestion_cache", schema="audion"):
        # Deployed DB already has the table (e.g. created manually or via partial deploy).
        # Avoid failing the entire release with DuplicateTable, but still ensure expected
        # index/constraints exist.
        existing_indexes = {idx.get("name") for idx in inspector.get_indexes("ai_suggestion_cache", schema="audion")}
        if "ix_ai_suggestion_cache_project_kind_updated" not in existing_indexes:
            op.create_index(
                "ix_ai_suggestion_cache_project_kind_updated",
                "ai_suggestion_cache",
                ["project_id", "kind", "updated_at"],
                unique=False,
                schema="audion",
            )

        existing_uniques = {uc.get("name") for uc in inspector.get_unique_constraints("ai_suggestion_cache", schema="audion")}
        if "uq_ai_suggestion_cache_key" not in existing_uniques:
            op.create_unique_constraint(
                "uq_ai_suggestion_cache_key",
                "ai_suggestion_cache",
                ["project_id", "kind", "context_hash"],
                schema="audion",
            )
        return

    op.create_table(
        "ai_suggestion_cache",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("project_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("audion.projects.id", ondelete="CASCADE"), nullable=False),
        sa.Column("kind", sa.String(length=64), nullable=False),
        sa.Column("context_hash", sa.String(length=64), nullable=False),
        sa.Column("request_payload", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("response_payload", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("meta", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.text("now()")),
        sa.UniqueConstraint("project_id", "kind", "context_hash", name="uq_ai_suggestion_cache_key"),
        schema="audion",
    )
    op.create_index(
        "ix_ai_suggestion_cache_project_kind_updated",
        "ai_suggestion_cache",
        ["project_id", "kind", "updated_at"],
        unique=False,
        schema="audion",
    )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)
    if not inspector.has_table("ai_suggestion_cache", schema="audion"):
        return

    op.drop_index("ix_ai_suggestion_cache_project_kind_updated", table_name="ai_suggestion_cache", schema="audion")
    op.drop_table("ai_suggestion_cache", schema="audion")

