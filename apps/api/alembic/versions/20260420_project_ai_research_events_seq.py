"""Add per-run seq to project research events (stable SSE cursor).

Revision ID: 20260420_proj_ai_evt_seq
Revises: 20260420_proj_ai_research_events
Create Date: 2026-04-20
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy import inspect, text


revision = "20260420_proj_ai_evt_seq"
down_revision = "20260420_proj_ai_research_events"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    insp = inspect(bind)
    if "project_research_events" not in set(insp.get_table_names(schema="audion")):
        return

    cols = {c["name"] for c in insp.get_columns("project_research_events", schema="audion")}
    if "seq" not in cols:
        op.add_column(
            "project_research_events",
            sa.Column("seq", sa.BigInteger(), nullable=True),
            schema="audion",
        )

    # Idempotent backfill for NULL seq (partitioned row numbers per run).
    op.execute(
        text(
            """
            WITH ranked AS (
              SELECT id, run_id,
                     ROW_NUMBER() OVER (PARTITION BY run_id ORDER BY created_at ASC, id ASC) AS rn
              FROM audion.project_research_events
              WHERE seq IS NULL
            )
            UPDATE audion.project_research_events e
            SET seq = ranked.rn
            FROM ranked
            WHERE e.id = ranked.id
            """
        )
    )

    op.alter_column("project_research_events", "seq", nullable=False, schema="audion")

    bind.execute(
        text(
            "CREATE UNIQUE INDEX IF NOT EXISTS ix_project_research_events_run_id_seq "
            "ON audion.project_research_events (run_id, seq)"
        )
    )


def downgrade() -> None:
    op.execute(text("DROP INDEX IF EXISTS audion.ix_project_research_events_run_id_seq"))
    insp = inspect(op.get_bind())
    if "project_research_events" in set(insp.get_table_names(schema="audion")):
        cols = {c["name"] for c in insp.get_columns("project_research_events", schema="audion")}
        if "seq" in cols:
            op.drop_column("project_research_events", "seq", schema="audion")
