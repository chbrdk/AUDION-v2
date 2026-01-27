"""fix_missing_object_key

Revision ID: 20260127_fix_obj_key
Revises: 20251205_perf_indexes
Create Date: 2026-01-27 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect


# revision identifiers, used by Alembic.
revision: str = '20260127_fix_obj_key'
down_revision: Union[str, None] = '20251205_perf_indexes'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Use Inspector to check if column exists before adding
    bind = op.get_bind()
    inspector = inspect(bind)
    columns = [col['name'] for col in inspector.get_columns('documents')]
    
    if 'object_key' not in columns:
        op.add_column(
            'documents',
            sa.Column('object_key', sa.String(length=512), nullable=True)
        )


def downgrade() -> None:
    # Safe drop
    op.execute("ALTER TABLE documents DROP COLUMN IF EXISTS object_key")
