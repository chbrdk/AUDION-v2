from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "20251120_01_persona_metadata"
down_revision = None
branch_labels = None
depends_on = None


persona_status_enum = postgresql.ENUM("draft", "published", "archived", name="persona_status", create_type=False)
persona_audit_action_enum = postgresql.ENUM("created", "updated", "published", "archived", "restored", name="persona_audit_action", create_type=False)


def upgrade() -> None:
    persona_status_enum.create(op.get_bind(), checkfirst=True)
    persona_audit_action_enum.create(op.get_bind(), checkfirst=True)

    op.add_column(
        "personas",
        sa.Column(
            "status",
            persona_status_enum,
            nullable=False,
            server_default="draft",
        ),
    )
    op.add_column(
        "personas",
        sa.Column("updated_at", sa.DateTime(), server_default=sa.text("now()"), nullable=False),
    )
    op.add_column(
        "personas",
        sa.Column("updated_by", sa.String(length=128), nullable=True),
    )
    op.add_column(
        "personas",
        sa.Column("last_reviewed_at", sa.DateTime(), nullable=True),
    )
    op.add_column(
        "personas",
        sa.Column("locked_by", sa.String(length=128), nullable=True),
    )
    op.add_column(
        "personas",
        sa.Column("locked_at", sa.DateTime(), nullable=True),
    )

    op.create_table(
        "persona_audit_logs",
        sa.Column("id", sa.dialects.postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("persona_id", sa.dialects.postgresql.UUID(as_uuid=True), sa.ForeignKey("personas.id", ondelete="CASCADE"), nullable=False),
        sa.Column("action", persona_audit_action_enum, nullable=False),
        sa.Column("actor", sa.String(length=128), nullable=False),
        sa.Column("payload_before", sa.JSON(), nullable=True),
        sa.Column("payload_after", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.text("now()"), nullable=False),
    )

    op.execute("ALTER TABLE personas ALTER COLUMN updated_at DROP DEFAULT")


def downgrade() -> None:
    op.drop_table("persona_audit_logs")
    op.drop_column("personas", "locked_at")
    op.drop_column("personas", "locked_by")
    op.drop_column("personas", "last_reviewed_at")
    op.drop_column("personas", "updated_by")
    op.drop_column("personas", "updated_at")
    op.drop_column("personas", "status")

    persona_audit_action_enum.drop(op.get_bind(), checkfirst=True)
    persona_status_enum.drop(op.get_bind(), checkfirst=True)

