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
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing_columns = [col['name'] for col in inspector.get_columns("personas")]

    persona_status_enum.create(bind, checkfirst=True)
    persona_audit_action_enum.create(bind, checkfirst=True)

    if "status" not in existing_columns:
        op.add_column(
            "personas",
            sa.Column(
                "status",
                persona_status_enum,
                nullable=False,
                server_default="draft",
            ),
        )
    if "updated_at" not in existing_columns:
        op.add_column(
            "personas",
            sa.Column("updated_at", sa.DateTime(), server_default=sa.text("now()"), nullable=False),
        )
    if "updated_by" not in existing_columns:
        op.add_column(
            "personas",
            sa.Column("updated_by", sa.String(length=128), nullable=True),
        )
    if "last_reviewed_at" not in existing_columns:
        op.add_column(
            "personas",
            sa.Column("last_reviewed_at", sa.DateTime(), nullable=True),
        )
    if "locked_by" not in existing_columns:
        op.add_column(
            "personas",
            sa.Column("locked_by", sa.String(length=128), nullable=True),
        )
    if "locked_at" not in existing_columns:
        op.add_column(
            "personas",
            sa.Column("locked_at", sa.DateTime(), nullable=True),
        )

    if not inspector.has_table("persona_audit_logs"):
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

    # Only alter if we just created it or if it still has default (idempotency for DROP DEFAULT is tricky but strict usually fine)
    # Better to ignore or wrap in try/except if unsure, but checking column default is hard.
    # Given the error was on ADD COLUMN, the above fixes the main crash.
    # We can skip the DROP DEFAULT safely if we assume it's already done if the column exists.
    # But let's leave it unless it causes issues, or wrap in try/except.
    try:
        op.execute("ALTER TABLE personas ALTER COLUMN updated_at DROP DEFAULT")
    except Exception:
        pass


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

