"""fix_missing_object_key

Revision ID: 20260127_fix_obj_key
Revises: 20251205_perf_indexes
Create Date: 2026-01-27 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.engine.reflection import Inspector


# revision identifiers, used by Alembic.
revision: str = '20260127_fix_obj_key'
down_revision: Union[str, None] = '20251205_perf_indexes'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Use raw SQL to explicitly handle the addition idempotently
    # We rely on the search_path being set to 'audion, public' by env.py/db.py
    # or explicit schema qualification if needed. 
    # Given the strict enforcement of 'audion' schema, we target it directly to be safe.
    
    print("Running patch migration 20260127_fix_obj_key...")
    
    bind = op.get_bind()
    # Check if we are running on Postgres to use IF NOT EXISTS syntax
    if bind.dialect.name == 'postgresql':
        op.execute("ALTER TABLE audion.documents ADD COLUMN IF NOT EXISTS object_key VARCHAR(512)")
    else:
        # Fallback for other dialects (unlikely in this stack)
        inspector = Inspector.from_engine(bind)
        columns = [col['name'] for col in inspector.get_columns('documents', schema='audion')]
        if 'object_key' not in columns:
            op.add_column('documents', sa.Column('object_key', sa.String(512), nullable=True), schema='audion')


def downgrade() -> None:
    bind = op.get_bind()
    print("Reverting patch migration 20260127_fix_obj_key...")
    if bind.dialect.name == 'postgresql':
        op.execute("ALTER TABLE audion.documents DROP COLUMN IF EXISTS object_key")
    else:
        op.drop_column('documents', 'object_key', schema='audion')
