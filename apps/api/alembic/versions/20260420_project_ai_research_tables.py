"""Add project AI research tables (runs, sources, summaries).

Revision ID: 20260420_proj_ai_research
Revises: 20260418_proj_tg_pub_stat
Create Date: 2026-04-20
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB, UUID


revision = "20260420_proj_ai_research"
down_revision = "20260418_proj_tg_pub_stat"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "project_research_runs",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("project_id", UUID(as_uuid=True), sa.ForeignKey("audion.projects.id", ondelete="CASCADE"), nullable=False),
        sa.Column("requested_by_user_id", UUID(as_uuid=True), sa.ForeignKey("audion.users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("status", sa.Enum("queued", "running", "succeeded", "failed", name="project_research_run_status"), nullable=False, server_default="queued"),
        sa.Column("seed_url", sa.Text(), nullable=False),
        sa.Column("crawl_limits", JSONB(), nullable=True),
        sa.Column("error", sa.Text(), nullable=True),
        sa.Column("started_at", sa.DateTime(), nullable=True),
        sa.Column("finished_at", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        schema="audion",
    )
    op.alter_column("project_research_runs", "status", server_default=None, schema="audion")
    op.create_index(
        "ix_project_research_runs_project_id_created_at",
        "project_research_runs",
        ["project_id", "created_at"],
        schema="audion",
    )

    op.create_table(
        "project_research_sources",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("run_id", UUID(as_uuid=True), sa.ForeignKey("audion.project_research_runs.id", ondelete="CASCADE"), nullable=False),
        sa.Column("url", sa.Text(), nullable=False),
        sa.Column("title", sa.Text(), nullable=True),
        sa.Column("content_type", sa.String(length=128), nullable=True),
        sa.Column("fetched_at", sa.DateTime(), nullable=False),
        sa.Column("content_hash", sa.String(length=64), nullable=True),
        sa.Column("text_excerpt", sa.Text(), nullable=True),
        sa.Column("raw_text", sa.Text(), nullable=True),
        sa.Column("meta", JSONB(), nullable=True),
        sa.UniqueConstraint("run_id", "url", name="uq_project_research_source_run_url"),
        schema="audion",
    )
    op.create_index(
        "ix_project_research_sources_run_id",
        "project_research_sources",
        ["run_id"],
        schema="audion",
    )
    op.create_index(
        "ix_project_research_sources_content_hash",
        "project_research_sources",
        ["content_hash"],
        schema="audion",
    )

    op.create_table(
        "project_research_summaries",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("run_id", UUID(as_uuid=True), sa.ForeignKey("audion.project_research_runs.id", ondelete="CASCADE"), nullable=False),
        sa.Column("summary_en", JSONB(), nullable=False),
        sa.Column("summary_de", JSONB(), nullable=True),
        sa.Column("citations", JSONB(), nullable=True),
        sa.Column("model", sa.String(length=128), nullable=True),
        sa.Column("usage", JSONB(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.UniqueConstraint("run_id", name="uq_project_research_summary_run"),
        schema="audion",
    )
    op.create_index(
        "ix_project_research_summaries_run_id",
        "project_research_summaries",
        ["run_id"],
        unique=True,
        schema="audion",
    )


def downgrade() -> None:
    op.drop_index("ix_project_research_summaries_run_id", table_name="project_research_summaries", schema="audion")
    op.drop_table("project_research_summaries", schema="audion")

    op.drop_index("ix_project_research_sources_content_hash", table_name="project_research_sources", schema="audion")
    op.drop_index("ix_project_research_sources_run_id", table_name="project_research_sources", schema="audion")
    op.drop_table("project_research_sources", schema="audion")

    op.drop_index("ix_project_research_runs_project_id_created_at", table_name="project_research_runs", schema="audion")
    op.drop_table("project_research_runs", schema="audion")

    op.execute("DROP TYPE IF EXISTS audion.project_research_run_status")

