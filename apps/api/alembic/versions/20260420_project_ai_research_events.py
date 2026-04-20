"""Add project AI research events table (streaming progress).

Revision ID: 20260420_proj_ai_research_events
Revises: 20260420_proj_ai_research
Create Date: 2026-04-20
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB, UUID


revision = "20260420_proj_ai_research_events"
down_revision = "20260420_proj_ai_research"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "project_research_events",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column(
            "run_id",
            UUID(as_uuid=True),
            sa.ForeignKey("audion.project_research_runs.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("event_type", sa.String(length=64), nullable=False),
        sa.Column("message", sa.Text(), nullable=True),
        sa.Column("payload", JSONB(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        schema="audion",
    )
    op.create_index(
        "ix_project_research_events_run_id_created_at",
        "project_research_events",
        ["run_id", "created_at"],
        schema="audion",
    )


def downgrade() -> None:
    op.drop_index("ix_project_research_events_run_id_created_at", table_name="project_research_events", schema="audion")
    op.drop_table("project_research_events", schema="audion")

