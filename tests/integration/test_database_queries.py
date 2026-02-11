"""
Integration Tests für Database Query Optimierungen

Testet die SQLAlchemy 2.0 Migration und Query-Performance
"""

import pytest
from uuid import uuid4
from sqlalchemy import select

from apps.api.app.db import get_session
from apps.api.app.models import Persona, Document, ProcessingJob


@pytest.mark.integration
class TestDatabaseQueries:
    """Tests für optimierte Database Queries"""
    
    def test_persona_query_with_select(self):
        """Test dass Persona-Queries mit select() Syntax funktionieren"""
        with get_session() as session:
            # SQLAlchemy 2.0 Syntax
            result = session.scalars(
                select(Persona).where(Persona.status == "published").limit(10)
            ).all()
            
            assert isinstance(result, list)
            # Alle Ergebnisse sollten Persona-Instanzen sein
            for persona in result:
                assert isinstance(persona, Persona)
    
    def test_document_query_with_target_group_filter(self):
        """Test dass Document-Queries mit target_group_id Filter funktionieren"""
        with get_session() as session:
            # Test mit select() Syntax
            target_group_id = uuid4()
            result = session.scalars(
                select(Document).where(Document.target_group_id == target_group_id)
            ).all()
            
            assert isinstance(result, list)
            # Alle Dokumente sollten zur target_group gehören
            for doc in result:
                assert doc.target_group_id == target_group_id
    
    def test_processing_job_query(self):
        """Test ProcessingJob Queries"""
        with get_session() as session:
            # Test mit select() Syntax
            result = session.scalars(
                select(ProcessingJob).where(ProcessingJob.status == "pending")
            ).all()
            
            assert isinstance(result, list)
    
    def test_composite_query_personas_status_target_group(self):
        """Test Composite Index Query (status + target_group_id)"""
        with get_session() as session:
            target_group_id = uuid4()
            result = session.scalars(
                select(Persona)
                .where(Persona.status == "published")
                .where(Persona.target_group_id == target_group_id)
            ).all()
            
            assert isinstance(result, list)
            for persona in result:
                assert persona.status == "published"
                assert persona.target_group_id == target_group_id
    
    def test_query_performance_baseline(self):
        """Test Query Performance - sollte schnell sein mit Indizes"""
        import time
        
        with get_session() as session:
            target_group_id = uuid4()
            
            # Measure query time
            start = time.time()
            result = session.scalars(
                select(Persona).where(Persona.target_group_id == target_group_id)
            ).all()
            elapsed = time.time() - start
            
            # Query sollte schnell sein (< 100ms für einfache Query)
            # Mit Index sollte es noch schneller sein
            assert elapsed < 0.1, f"Query took {elapsed}s, expected < 0.1s"
            assert isinstance(result, list)
