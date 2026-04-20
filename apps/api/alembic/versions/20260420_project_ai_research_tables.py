"""Add project AI research tables (runs, sources, summaries).

Revision ID: 20260420_proj_ai_research
Revises: 20260418_proj_tg_pub_stat
Create Date: 2026-04-20
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy import inspect, text
from sqlalchemy.dialects.postgresql import ENUM, JSONB, UUID


revision = "20260420_proj_ai_research"
down_revision = "20260418_proj_tg_pub_stat"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    insp = inspect(bind)
    audion_tables = set(insp.get_table_names(schema="audion"))

    bind.execute(
        text(
            """
            DO $do$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1
                    FROM pg_catalog.pg_type t
                    JOIN pg_catalog.pg_namespace n ON n.oid = t.typnamespace
                    WHERE n.nspname = 'audion' AND t.typname = 'project_research_run_status'
                ) THEN
                    CREATE TYPE audion.project_research_run_status AS ENUM (
                        'queued', 'running', 'succeeded', 'failed'
                    );
                END IF;
            END
            $do$;
            """
        )
    )

    run_status = ENUM(
        "queued",
        "running",
        "succeeded",
        "failed",
        name="project_research_run_status",
        schema="audion",
        create_type=False,
    )

    if "project_research_runs" not in audion_tables:
        op.create_table(
            "project_research_runs",
            sa.Column("id", UUID(as_uuid=True), primary_key=True, nullable=False),
            sa.Column(
                "project_id",
                UUID(as_uuid=True),
                sa.ForeignKey("audion.projects.id", ondelete="CASCADE"),
                nullable=False,
            ),
            sa.Column(
                "requested_by_user_id",
                UUID(as_uuid=True),
                sa.ForeignKey("audion.users.id", ondelete="SET NULL"),
                nullable=True,
            ),
            sa.Column(
                "status",
                run_status,
                nullable=False,
                server_default="queued",
            ),
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

    if "project_research_sources" not in audion_tables:
        op.create_table(
            "project_research_sources",
            sa.Column("id", UUID(as_uuid=True), primary_key=True, nullable=False),
            sa.Column(
                "run_id",
                UUID(as_uuid=True),
                sa.ForeignKey("audion.project_research_runs.id", ondelete="CASCADE"),
                nullable=False,
            ),
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

    if "project_research_summaries" not in audion_tables:
        op.create_table(
            "project_research_summaries",
            sa.Column("id", UUID(as_uuid=True), primary_key=True, nullable=False),
            sa.Column(
                "run_id",
                UUID(as_uuid=True),
                sa.ForeignKey("audion.project_research_runs.id", ondelete="CASCADE"),
                nullable=False,
            ),
            sa.Column("summary_en", JSONB(), nullable=False),
            sa.Column("summary_de", JSONB(), nullable=True),
            sa.Column("citations", JSONB(), nullable=True),
            sa.Column("model", sa.String(length=128), nullable=True),
            sa.Column("usage", JSONB(), nullable=True),
            sa.Column("created_at", sa.DateTime(), nullable=False),
            sa.UniqueConstraint("run_id", name="uq_project_research_summary_run"),
            schema="audion",
        )

    # Indexes: only after tables exist (new installs or legacy DBs).
    insp = inspect(bind)
    names = set(insp.get_table_names(schema="audion"))
    if "project_research_runs" in names:
        bind.execute(
            text(
                "CREATE INDEX IF NOT EXISTS ix_project_research_runs_project_id_created_at "
                "ON audion.project_research_runs (project_id, created_at)"
            )
        )
    if "project_research_sources" in names:
        bind.execute(
            text(
                "CREATE INDEX IF NOT EXISTS ix_project_research_sources_run_id "
                "ON audion.project_research_sources (run_id)"
            )
        )
        bind.execute(
            text(
                "CREATE INDEX IF NOT EXISTS ix_project_research_sources_content_hash "
                "ON audion.project_research_sources (content_hash)"
            )
        )
    if "project_research_summaries" in names:
        bind.execute(
            text(
                "CREATE UNIQUE INDEX IF NOT EXISTS ix_project_research_summaries_run_id "
                "ON audion.project_research_summaries (run_id)"
            )
        )


def downgrade() -> None:
    op.execute(text("DROP INDEX IF EXISTS audion.ix_project_research_summaries_run_id"))
    op.execute(text("DROP TABLE IF EXISTS audion.project_research_summaries CASCADE"))
    op.execute(text("DROP INDEX IF EXISTS audion.ix_project_research_sources_content_hash"))
    op.execute(text("DROP INDEX IF EXISTS audion.ix_project_research_sources_run_id"))
    op.execute(text("DROP TABLE IF EXISTS audion.project_research_sources CASCADE"))
    op.execute(text("DROP INDEX IF EXISTS audion.ix_project_research_runs_project_id_created_at"))
    op.execute(text("DROP TABLE IF EXISTS audion.project_research_runs CASCADE"))
    op.execute(text("DROP TYPE IF EXISTS audion.project_research_run_status"))
