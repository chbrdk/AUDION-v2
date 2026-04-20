"""Add per-run seq to project research events (stable SSE cursor).

Revision ID: 20260420_proj_ai_research_events_seq
Revises: 20260420_proj_ai_research_events
Create Date: 2026-04-20
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op


revision = "20260420_proj_ai_research_events_seq"
down_revision = "20260420_proj_ai_research_events"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("project_research_events", sa.Column("seq", sa.BigInteger(), nullable=True), schema="audion")

    # For brand-new deployments, there are no rows yet; for existing envs, backfill deterministically by created_at.
    op.execute(
        """
        WITH ranked AS (
          SELECT id, run_id,
                 ROW_NUMBER() OVER (PARTITION BY run_id ORDER BY created_at ASC, id ASC) AS rn
          FROM audion.project_research_events
        )
        UPDATE audion.project_research_events e
        SET seq = ranked.rn
        FROM ranked
        WHERE e.id = ranked.id
        """
    )

    op.alter_column("project_research_events", "seq", nullable=False, schema="audion")
    op.create_index(
        "ix_project_research_events_run_id_seq",
        "project_research_events",
        ["run_id", "seq"],
        unique=True,
        schema="audion",
    )


def downgrade() -> None:
    op.drop_index("ix_project_research_events_run_id_seq", table_name="project_research_events", schema="audion")
    op.drop_column("project_research_events", "seq", schema="audion")

