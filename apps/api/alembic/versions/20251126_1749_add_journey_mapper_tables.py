from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "20251126_1749_journey_mapper"
down_revision = "20251123_1813_kg_entry"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Helper to create enum if not exists
    def create_enum_if_not_exists(enum_name, values):
        op.execute(f"DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = '{enum_name}') THEN CREATE TYPE {enum_name} AS ENUM ({values}); END IF; END $$;")

    # Create ENUM types
    create_enum_if_not_exists('journey_element_type', "'action', 'thought', 'feeling', 'touchpoint', 'pain_point', 'opportunity', 'question', 'quote'")
    create_enum_if_not_exists('journey_metric_type', "'sessions', 'users', 'page_views', 'bounce_rate', 'time_on_page', 'scroll_depth', 'engagement_rate', 'conversion_rate', 'form_submissions', 'cta_clicks', 'cta_click_rate', 'rage_clicks', 'u_turns', 'error_clicks', 'leads', 'opportunities', 'revenue'")
    create_enum_if_not_exists('journey_comparison_operator', "'equals', 'not_equals', 'greater_than', 'less_than', 'greater_or_equal', 'less_or_equal', 'between'")
    create_enum_if_not_exists('journey_measurement_status', "'good', 'warning', 'critical', 'no_data'")
    create_enum_if_not_exists('journey_insight_type', "'confirmation', 'contradiction', 'discovery', 'anomaly'")
    create_enum_if_not_exists('journey_creation_mode', "'manual', 'ai_generated', 'hybrid'")
    create_enum_if_not_exists('journey_status', "'draft', 'active', 'validated', 'archived'")
    create_enum_if_not_exists('journey_insight_status', "'new', 'acknowledged', 'actioned', 'dismissed'")
    
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    # Create journeys table
    if not inspector.has_table("journeys"):
        op.create_table(
            "journeys",
            sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
            sa.Column("organization_id", postgresql.UUID(as_uuid=True), nullable=False),
            sa.Column("project_id", postgresql.UUID(as_uuid=True), nullable=True),
            sa.Column("target_group_id", postgresql.UUID(as_uuid=True), nullable=True),
            sa.Column("name", sa.String(256), nullable=False),
            sa.Column("description", sa.Text(), nullable=True),
            sa.Column("journey_type", sa.String(128), nullable=False),
            sa.Column("creation_mode", sa.Enum("manual", "ai_generated", "hybrid", name="journey_creation_mode"), nullable=False),
            sa.Column("status", sa.Enum("draft", "active", "validated", "archived", name="journey_status"), nullable=False, server_default="draft"),
            sa.Column("validation_score", sa.Float(), nullable=True),
            sa.Column("tracking_enabled", sa.Boolean(), nullable=False, server_default="false"),
            sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
            sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.func.now(), onupdate=sa.func.now()),
            sa.Column("created_by", sa.String(128), nullable=True),
            sa.ForeignKeyConstraint(["target_group_id"], ["target_groups.id"], ondelete="SET NULL"),
        )
        op.create_index("ix_journeys_target_group_id", "journeys", ["target_group_id"])
        op.create_index("ix_journeys_project_id", "journeys", ["project_id"])
        op.create_index("ix_journeys_status", "journeys", ["status"])
    
    # Create journey_phases table
    if not inspector.has_table("journey_phases"):
        op.create_table(
            "journey_phases",
            sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
            sa.Column("journey_id", postgresql.UUID(as_uuid=True), nullable=False),
            sa.Column("name", sa.String(256), nullable=False),
            sa.Column("description", sa.Text(), nullable=True),
            sa.Column("phase_order", sa.Integer(), nullable=False),
            sa.Column("expected_duration_min", sa.Integer(), nullable=True),
            sa.Column("expected_duration_max", sa.Integer(), nullable=True),
            sa.Column("duration_unit", sa.String(32), nullable=True, server_default="minutes"),
            sa.Column("expected_emotion", sa.String(64), nullable=True),
            sa.Column("emotion_intensity", sa.Float(), nullable=True),
            sa.Column("url_pattern", postgresql.JSONB(), nullable=True),
            sa.Column("form_id", postgresql.JSONB(), nullable=True),
            sa.Column("event_names", postgresql.JSONB(), nullable=True),
            sa.Column("validation_status", sa.String(64), nullable=True),
            sa.Column("validation_score", sa.Float(), nullable=True),
            sa.Column("generated_by_ai", sa.Boolean(), nullable=False, server_default="false"),
            sa.Column("generation_confidence", sa.Float(), nullable=True),
            sa.Column("source_chunks", postgresql.JSONB(), nullable=True),
            sa.ForeignKeyConstraint(["journey_id"], ["journeys.id"], ondelete="CASCADE"),
        )
        op.create_index("ix_journey_phases_journey_id", "journey_phases", ["journey_id"])
        op.create_index("ix_journey_phases_phase_order", "journey_phases", ["journey_id", "phase_order"])
    
    # Create journey_phase_elements table
    if not inspector.has_table("journey_phase_elements"):
        op.create_table(
            "journey_phase_elements",
            sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
            sa.Column("phase_id", postgresql.UUID(as_uuid=True), nullable=False),
            sa.Column("element_type", sa.Enum("action", "thought", "feeling", "touchpoint", "pain_point", "opportunity", "question", "quote", name="journey_element_type"), nullable=False),
            sa.Column("content", sa.Text(), nullable=False),
            sa.Column("element_order", sa.Integer(), nullable=False),
            sa.Column("metadata", postgresql.JSONB(), nullable=True),
            sa.Column("source_type", sa.String(64), nullable=True),
            sa.Column("source_chunk_ids", postgresql.JSONB(), nullable=True),
            sa.Column("confidence", sa.Float(), nullable=True),
            sa.ForeignKeyConstraint(["phase_id"], ["journey_phases.id"], ondelete="CASCADE"),
        )
        op.create_index("ix_journey_phase_elements_phase_id", "journey_phase_elements", ["phase_id"])
        op.create_index("ix_journey_phase_elements_element_order", "journey_phase_elements", ["phase_id", "element_order"])
    
    # Create journey_expectations table
    if not inspector.has_table("journey_expectations"):
        op.create_table(
            "journey_expectations",
            sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
            sa.Column("phase_id", postgresql.UUID(as_uuid=True), nullable=False),
            sa.Column("metric_type", sa.Enum("sessions", "users", "page_views", "bounce_rate", "time_on_page", "scroll_depth", "engagement_rate", "conversion_rate", "form_submissions", "cta_clicks", "cta_click_rate", "rage_clicks", "u_turns", "error_clicks", "leads", "opportunities", "revenue", name="journey_metric_type"), nullable=False),
            sa.Column("metric_name", sa.String(128), nullable=False),
            sa.Column("expected_value", sa.Float(), nullable=True),
            sa.Column("expected_value_max", sa.Float(), nullable=True),
            sa.Column("unit", sa.String(32), nullable=True),
            sa.Column("comparison", sa.Enum("equals", "not_equals", "greater_than", "less_than", "greater_or_equal", "less_or_equal", "between", name="journey_comparison_operator"), nullable=False),
            sa.Column("warning_threshold_percent", sa.Float(), nullable=True),
            sa.Column("critical_threshold_percent", sa.Float(), nullable=True),
            sa.Column("hypothesis", sa.Text(), nullable=True),
            sa.Column("based_on_persona_id", postgresql.UUID(as_uuid=True), nullable=True),
            sa.Column("data_source", sa.String(64), nullable=False),
            sa.Column("data_source_config", postgresql.JSONB(), nullable=True),
            sa.ForeignKeyConstraint(["phase_id"], ["journey_phases.id"], ondelete="CASCADE"),
            sa.ForeignKeyConstraint(["based_on_persona_id"], ["personas.id"], ondelete="SET NULL"),
        )
        op.create_index("ix_journey_expectations_phase_id", "journey_expectations", ["phase_id"])
        op.create_index("ix_journey_expectations_persona_id", "journey_expectations", ["based_on_persona_id"])
    
    # Create journey_measurements table
    if not inspector.has_table("journey_measurements"):
        op.create_table(
            "journey_measurements",
            sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
            sa.Column("expectation_id", postgresql.UUID(as_uuid=True), nullable=False),
            sa.Column("period_start", sa.DateTime(), nullable=False),
            sa.Column("period_end", sa.DateTime(), nullable=False),
            sa.Column("actual_value", sa.Float(), nullable=False),
            sa.Column("delta_absolute", sa.Float(), nullable=True),
            sa.Column("delta_percent", sa.Float(), nullable=True),
            sa.Column("status", sa.Enum("good", "warning", "critical", "no_data", name="journey_measurement_status"), nullable=False),
            sa.Column("sample_size", sa.Integer(), nullable=True),
            sa.Column("data_source", sa.String(64), nullable=False),
            sa.Column("raw_data", postgresql.JSONB(), nullable=True),
            sa.Column("synced_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
            sa.ForeignKeyConstraint(["expectation_id"], ["journey_expectations.id"], ondelete="CASCADE"),
        )
        op.create_index("ix_journey_measurements_expectation_id", "journey_measurements", ["expectation_id"])
        op.create_index("ix_journey_measurements_period", "journey_measurements", ["period_start", "period_end"])
    
    # Create journey_insights table
    if not inspector.has_table("journey_insights"):
        op.create_table(
            "journey_insights",
            sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
            sa.Column("journey_id", postgresql.UUID(as_uuid=True), nullable=False),
            sa.Column("phase_id", postgresql.UUID(as_uuid=True), nullable=True),
            sa.Column("expectation_id", postgresql.UUID(as_uuid=True), nullable=True),
            sa.Column("insight_type", sa.Enum("confirmation", "contradiction", "discovery", "anomaly", name="journey_insight_type"), nullable=False),
            sa.Column("title", sa.String(256), nullable=False),
            sa.Column("description", sa.Text(), nullable=True),
            sa.Column("ai_analysis", postgresql.JSONB(), nullable=True),
            sa.Column("ai_recommendations", postgresql.JSONB(), nullable=True),
            sa.Column("evidence", postgresql.JSONB(), nullable=True),
            sa.Column("confidence", sa.Float(), nullable=True),
            sa.Column("priority", sa.Float(), nullable=True),
            sa.Column("status", sa.Enum("new", "acknowledged", "actioned", "dismissed", name="journey_insight_status"), nullable=False, server_default="new"),
            sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
            sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.func.now(), onupdate=sa.func.now()),
            sa.ForeignKeyConstraint(["journey_id"], ["journeys.id"], ondelete="CASCADE"),
            sa.ForeignKeyConstraint(["phase_id"], ["journey_phases.id"], ondelete="SET NULL"),
            sa.ForeignKeyConstraint(["expectation_id"], ["journey_expectations.id"], ondelete="SET NULL"),
        )
        op.create_index("ix_journey_insights_journey_id", "journey_insights", ["journey_id"])
        op.create_index("ix_journey_insights_status", "journey_insights", ["status"])
    
    # Create journey_changes table
    if not inspector.has_table("journey_changes"):
        op.create_table(
            "journey_changes",
            sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
            sa.Column("journey_id", postgresql.UUID(as_uuid=True), nullable=False),
            sa.Column("phase_id", postgresql.UUID(as_uuid=True), nullable=True),
            sa.Column("title", sa.String(256), nullable=False),
            sa.Column("description", sa.Text(), nullable=True),
            sa.Column("change_type", sa.String(64), nullable=False),
            sa.Column("triggered_by_insight_id", postgresql.UUID(as_uuid=True), nullable=True),
            sa.Column("expected_metric", sa.String(128), nullable=True),
            sa.Column("expected_improvement_percent", sa.Float(), nullable=True),
            sa.Column("implementation_status", sa.String(64), nullable=True),
            sa.Column("implemented_at", sa.DateTime(), nullable=True),
            sa.Column("actual_improvement_percent", sa.Float(), nullable=True),
            sa.Column("result_status", sa.String(64), nullable=True),
            sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
            sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.func.now(), onupdate=sa.func.now()),
            sa.ForeignKeyConstraint(["journey_id"], ["journeys.id"], ondelete="CASCADE"),
            sa.ForeignKeyConstraint(["phase_id"], ["journey_phases.id"], ondelete="SET NULL"),
            sa.ForeignKeyConstraint(["triggered_by_insight_id"], ["journey_insights.id"], ondelete="SET NULL"),
        )
        op.create_index("ix_journey_changes_journey_id", "journey_changes", ["journey_id"])


def downgrade() -> None:
    # Drop tables in reverse order
    op.drop_table("journey_changes")
    op.drop_table("journey_insights")
    op.drop_table("journey_measurements")
    op.drop_table("journey_expectations")
    op.drop_table("journey_phase_elements")
    op.drop_table("journey_phases")
    op.drop_table("journeys")
    
    # Drop ENUM types
    op.execute("DROP TYPE IF EXISTS journey_insight_status")
    op.execute("DROP TYPE IF EXISTS journey_status")
    op.execute("DROP TYPE IF EXISTS journey_creation_mode")
    op.execute("DROP TYPE IF EXISTS journey_insight_type")
    op.execute("DROP TYPE IF EXISTS journey_measurement_status")
    op.execute("DROP TYPE IF EXISTS journey_comparison_operator")
    op.execute("DROP TYPE IF EXISTS journey_metric_type")
    op.execute("DROP TYPE IF EXISTS journey_element_type")
