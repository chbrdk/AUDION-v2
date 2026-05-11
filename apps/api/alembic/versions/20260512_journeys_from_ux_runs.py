"""Backlinks between persona_ux_journey_runs and journeys.

Revision ID: 20260512_journeys_from_ux_runs
Revises: 20260510_persona_ux_journey_runs
Create Date: 2026-05-12
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect
from sqlalchemy.dialects import postgresql


revision = "20260512_journeys_from_ux_runs"
down_revision = "20260510_persona_ux_journey_runs"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    insp = inspect(bind)

    tables = insp.get_table_names(schema="audion")
    if "persona_ux_journey_runs" in tables:
        run_cols = {c["name"] for c in insp.get_columns("persona_ux_journey_runs", schema="audion")}
        if "derived_journey_id" not in run_cols:
            op.add_column(
                "persona_ux_journey_runs",
                sa.Column("derived_journey_id", postgresql.UUID(as_uuid=True), nullable=True),
                schema="audion",
            )
            # FK only if journeys exists (typically true in real envs).
            if "journeys" in tables:
                op.create_foreign_key(
                    "fk_persona_ux_journey_runs_derived_journey",
                    "persona_ux_journey_runs",
                    "journeys",
                    ["derived_journey_id"],
                    ["id"],
                    source_schema="audion",
                    referent_schema="audion",
                    ondelete="SET NULL",
                )
            op.create_index(
                "ix_persona_ux_journey_runs_derived_journey_id",
                "persona_ux_journey_runs",
                ["derived_journey_id"],
                schema="audion",
            )

    if "journeys" in tables:
        journey_cols = {c["name"] for c in insp.get_columns("journeys", schema="audion")}
        if "source_ux_journey_run_id" not in journey_cols:
            op.add_column(
                "journeys",
                sa.Column("source_ux_journey_run_id", postgresql.UUID(as_uuid=True), nullable=True),
                schema="audion",
            )
            op.create_index(
                "ix_journeys_source_ux_journey_run_id",
                "journeys",
                ["source_ux_journey_run_id"],
                schema="audion",
            )


def downgrade() -> None:
    bind = op.get_bind()
    insp = inspect(bind)
    tables = insp.get_table_names(schema="audion")

    if "journeys" in tables:
        op.drop_index("ix_journeys_source_ux_journey_run_id", table_name="journeys", schema="audion")
        op.drop_column("journeys", "source_ux_journey_run_id", schema="audion")

    if "persona_ux_journey_runs" in tables:
        op.drop_index(
            "ix_persona_ux_journey_runs_derived_journey_id",
            table_name="persona_ux_journey_runs",
            schema="audion",
        )
        try:
            op.drop_constraint(
                "fk_persona_ux_journey_runs_derived_journey",
                "persona_ux_journey_runs",
                schema="audion",
                type_="foreignkey",
            )
        except Exception:
            pass
        op.drop_column("persona_ux_journey_runs", "derived_journey_id", schema="audion")
