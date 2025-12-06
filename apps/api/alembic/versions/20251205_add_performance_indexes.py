"""add_performance_indexes

Revision ID: 20251205_perf_indexes
Revises: 20251203_template_metadata
Create Date: 2025-12-05 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '20251205_perf_indexes'
down_revision: Union[str, None] = '20251203_template_metadata'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Index for personas.target_group_id - frequently filtered
    op.create_index(
        'idx_personas_target_group_id',
        'personas',
        ['target_group_id'],
        unique=False
    )
    
    # Index for documents.target_group_id - frequently filtered
    op.create_index(
        'idx_documents_target_group_id',
        'documents',
        ['target_group_id'],
        unique=False
    )
    
    # Index for documents.persona_id - frequently filtered
    op.create_index(
        'idx_documents_persona_id',
        'documents',
        ['persona_id'],
        unique=False
    )
    
    # Index for processing_jobs.document_id - frequently filtered and joined
    op.create_index(
        'idx_processing_jobs_document_id',
        'processing_jobs',
        ['document_id'],
        unique=False
    )
    
    # Index for processing_jobs.status - frequently filtered
    op.create_index(
        'idx_processing_jobs_status',
        'processing_jobs',
        ['status'],
        unique=False
    )
    
    # Index for target_group_sources.target_group_id - frequently filtered
    op.create_index(
        'idx_target_group_sources_target_group_id',
        'target_group_sources',
        ['target_group_id'],
        unique=False
    )
    
    # Index for target_group_sources.chunk_id - frequently joined
    op.create_index(
        'idx_target_group_sources_chunk_id',
        'target_group_sources',
        ['chunk_id'],
        unique=False
    )
    
    # Index for document_chunks.document_id - frequently filtered
    op.create_index(
        'idx_document_chunks_document_id',
        'document_chunks',
        ['document_id'],
        unique=False
    )
    
    # Index for document_chunks.knowledge_entry_id - frequently filtered
    op.create_index(
        'idx_document_chunks_knowledge_entry_id',
        'document_chunks',
        ['knowledge_entry_id'],
        unique=False
    )
    
    # Index for persona_sources.persona_id - frequently filtered
    op.create_index(
        'idx_persona_sources_persona_id',
        'persona_sources',
        ['persona_id'],
        unique=False
    )
    
    # Composite index for personas (status + target_group_id) - common query pattern
    op.create_index(
        'idx_personas_status_target_group',
        'personas',
        ['status', 'target_group_id'],
        unique=False
    )
    
    # Composite index for documents (status + target_group_id) - common query pattern
    op.create_index(
        'idx_documents_status_target_group',
        'documents',
        ['status', 'target_group_id'],
        unique=False
    )


def downgrade() -> None:
    # Drop indexes in reverse order
    op.drop_index('idx_documents_status_target_group', table_name='documents')
    op.drop_index('idx_personas_status_target_group', table_name='personas')
    op.drop_index('idx_persona_sources_persona_id', table_name='persona_sources')
    op.drop_index('idx_document_chunks_knowledge_entry_id', table_name='document_chunks')
    op.drop_index('idx_document_chunks_document_id', table_name='document_chunks')
    op.drop_index('idx_target_group_sources_chunk_id', table_name='target_group_sources')
    op.drop_index('idx_target_group_sources_target_group_id', table_name='target_group_sources')
    op.drop_index('idx_processing_jobs_status', table_name='processing_jobs')
    op.drop_index('idx_processing_jobs_document_id', table_name='processing_jobs')
    op.drop_index('idx_documents_persona_id', table_name='documents')
    op.drop_index('idx_documents_target_group_id', table_name='documents')
    op.drop_index('idx_personas_target_group_id', table_name='personas')
