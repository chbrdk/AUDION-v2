"""Add persona_ux_journey_runs for UX-journey agent timeline.

Revision ID: 20260510_persona_ux_journey_runs
Revises: 20260421_merge_heads
Create Date: 2026-05-10
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect
from sqlalchemy.dialects import postgresql


revision = "20260510_persona_ux_journey_runs"
down_revision = "20260421_merge_heads"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    insp = inspect(bind)
    tables = insp.get_table_names(schema="audion")
    if "persona_ux_journey_runs" in tables:
        return

    op.create_table(
        "persona_ux_journey_runs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column(
            "persona_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("audion.personas.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("job_id", sa.String(length=80), nullable=False),
        sa.Column("task", sa.Text(), nullable=True),
        sa.Column("site_url", sa.Text(), nullable=True),
        sa.Column("success", sa.Boolean(), nullable=True),
        sa.Column("steps_count", sa.Integer(), nullable=True),
        sa.Column("scorecard", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.text("now()"), nullable=False),
        schema="audion",
    )
    op.create_index(
        "ix_persona_ux_journey_runs_persona_id",
        "persona_ux_journey_runs",
        ["persona_id"],
        schema="audion",
    )
    op.create_unique_constraint(
        "uq_persona_ux_journey_runs_persona_job",
        "persona_ux_journey_runs",
        ["persona_id", "job_id"],
        schema="audion",
    )


def downgrade() -> None:
    op.drop_constraint(
        "uq_persona_ux_journey_runs_persona_job",
        "persona_ux_journey_runs",
        schema="audion",
        type_="unique",
    )
    op.drop_index("ix_persona_ux_journey_runs_persona_id", table_name="persona_ux_journey_runs", schema="audion")
    op.drop_table("persona_ux_journey_runs", schema="audion")
