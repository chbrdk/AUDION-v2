"""Add ux_studies / ux_study_waves / ux_wave_run_items.

Revision ID: 20260730_ux_studies
Revises: 20260603_tg_lifecycle
Create Date: 2026-07-30
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect
from sqlalchemy.dialects import postgresql


revision = "20260730_ux_studies"
down_revision = "20260603_tg_lifecycle"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    insp = inspect(bind)
    tables = insp.get_table_names(schema="audion")

    if "ux_studies" not in tables:
        op.create_table(
            "ux_studies",
            sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
            sa.Column("name", sa.String(length=256), nullable=False),
            sa.Column("status", sa.String(length=32), nullable=False, server_default="draft"),
            sa.Column("description", sa.Text(), nullable=True),
            sa.Column(
                "project_id",
                postgresql.UUID(as_uuid=True),
                sa.ForeignKey("audion.projects.id", ondelete="SET NULL"),
                nullable=True,
            ),
            sa.Column("source_guide", sa.String(length=512), nullable=True),
            sa.Column("target_url_key", sa.String(length=128), nullable=True),
            sa.Column("hypothesis_templates", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
            sa.Column("created_at", sa.DateTime(), server_default=sa.text("now()"), nullable=False),
            sa.Column("updated_at", sa.DateTime(), server_default=sa.text("now()"), nullable=False),
            schema="audion",
        )
        op.create_index("ix_ux_studies_project_id", "ux_studies", ["project_id"], schema="audion")

    if "ux_study_waves" not in tables:
        op.create_table(
            "ux_study_waves",
            sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
            sa.Column(
                "study_id",
                postgresql.UUID(as_uuid=True),
                sa.ForeignKey("audion.ux_studies.id", ondelete="CASCADE"),
                nullable=False,
            ),
            sa.Column("wave_key", sa.String(length=128), nullable=False),
            sa.Column("status", sa.String(length=32), nullable=False, server_default="draft"),
            sa.Column("evaluation", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
            sa.Column("created_at", sa.DateTime(), server_default=sa.text("now()"), nullable=False),
            sa.Column("updated_at", sa.DateTime(), server_default=sa.text("now()"), nullable=False),
            schema="audion",
        )
        op.create_index("ix_ux_study_waves_study_id", "ux_study_waves", ["study_id"], schema="audion")
        op.create_unique_constraint(
            "uq_ux_study_waves_study_wave_key",
            "ux_study_waves",
            ["study_id", "wave_key"],
            schema="audion",
        )

    if "ux_wave_run_items" not in tables:
        op.create_table(
            "ux_wave_run_items",
            sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
            sa.Column(
                "wave_id",
                postgresql.UUID(as_uuid=True),
                sa.ForeignKey("audion.ux_study_waves.id", ondelete="CASCADE"),
                nullable=False,
            ),
            sa.Column("run_key", sa.String(length=128), nullable=False),
            sa.Column("leitfaden_block", sa.String(length=256), nullable=True),
            sa.Column(
                "persona_id",
                postgresql.UUID(as_uuid=True),
                sa.ForeignKey("audion.personas.id", ondelete="SET NULL"),
                nullable=True,
            ),
            sa.Column("persona_name", sa.String(length=256), nullable=True),
            sa.Column("segment", sa.String(length=128), nullable=True),
            sa.Column("url", sa.Text(), nullable=False),
            sa.Column("task", sa.Text(), nullable=False),
            sa.Column("max_steps", sa.Integer(), nullable=True),
            sa.Column("job_id", sa.String(length=80), nullable=True),
            sa.Column("agent_status", sa.String(length=64), nullable=True),
            sa.Column("agent_success", sa.Boolean(), nullable=True),
            sa.Column("task_completed", sa.Boolean(), nullable=True),
            sa.Column("valid_evidence", sa.Boolean(), nullable=True),
            sa.Column("valid_evidence_caveat", sa.Text(), nullable=True),
            sa.Column("blockers", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
            sa.Column("steps", sa.Integer(), nullable=True),
            sa.Column("friction_score", sa.Float(), nullable=True),
            sa.Column("persona_fit_score", sa.Float(), nullable=True),
            sa.Column("goal_reached", sa.Boolean(), nullable=True),
            sa.Column("finding", sa.Text(), nullable=True),
            sa.Column("categories", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
            sa.Column(
                "persona_ux_journey_run_id",
                postgresql.UUID(as_uuid=True),
                sa.ForeignKey("audion.persona_ux_journey_runs.id", ondelete="SET NULL"),
                nullable=True,
            ),
            sa.Column("created_at", sa.DateTime(), server_default=sa.text("now()"), nullable=False),
            sa.Column("updated_at", sa.DateTime(), server_default=sa.text("now()"), nullable=False),
            schema="audion",
        )
        op.create_index("ix_ux_wave_run_items_wave_id", "ux_wave_run_items", ["wave_id"], schema="audion")
        op.create_unique_constraint(
            "uq_ux_wave_run_items_wave_run_key",
            "ux_wave_run_items",
            ["wave_id", "run_key"],
            schema="audion",
        )


def downgrade() -> None:
    op.drop_constraint("uq_ux_wave_run_items_wave_run_key", "ux_wave_run_items", schema="audion", type_="unique")
    op.drop_index("ix_ux_wave_run_items_wave_id", table_name="ux_wave_run_items", schema="audion")
    op.drop_table("ux_wave_run_items", schema="audion")
    op.drop_constraint("uq_ux_study_waves_study_wave_key", "ux_study_waves", schema="audion", type_="unique")
    op.drop_index("ix_ux_study_waves_study_id", table_name="ux_study_waves", schema="audion")
    op.drop_table("ux_study_waves", schema="audion")
    op.drop_index("ix_ux_studies_project_id", table_name="ux_studies", schema="audion")
    op.drop_table("ux_studies", schema="audion")
