"""Add description and company_context to audion.projects for project/company knowledge.

Revision ID: 20260309_company_ctx
Revises: 20260309_tavus
Create Date: 2026-03-09

"""
from __future__ import annotations

from alembic import op

revision = "20260309_company_ctx"
down_revision = "20260309_tavus"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("ALTER TABLE audion.projects ADD COLUMN IF NOT EXISTS description TEXT NULL")
    op.execute("ALTER TABLE audion.projects ADD COLUMN IF NOT EXISTS company_context TEXT NULL")


def downgrade() -> None:
    op.execute("ALTER TABLE audion.projects DROP COLUMN IF EXISTS description")
    op.execute("ALTER TABLE audion.projects DROP COLUMN IF EXISTS company_context")
