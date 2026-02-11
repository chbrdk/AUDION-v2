"""
Quick script to check if a knowledge entry was ingested correctly.
Usage: python check_knowledge_ingestion.py [entry_id or search_term]
"""
from __future__ import annotations

import sys
from pathlib import Path
from uuid import UUID

ROOT = Path(__file__).resolve().parents[3]
if str(ROOT / "app") not in sys.path:
    sys.path.insert(0, str(ROOT / "app"))

from app.db import get_session
from app.models import DocumentChunk, TargetGroupKnowledgeEntry, TargetGroupSource
from qdrant_client import QdrantClient
from app.core.config import get_settings

def check_knowledge_entry(entry_id: str) -> None:
    """Check if knowledge entry was ingested correctly."""
    settings = get_settings()
    qdrant = QdrantClient(settings.qdrant_url, check_compatibility=False)
    
    with get_session() as session:
        try:
            entry_uuid = UUID(entry_id)
        except ValueError:
            print(f"❌ Ungültige UUID: {entry_id}")
            return
            
        entry = session.query(TargetGroupKnowledgeEntry).filter(
            TargetGroupKnowledgeEntry.id == entry_uuid
        ).first()
        
        if not entry:
            print(f"❌ Knowledge-Eintrag {entry_id} nicht gefunden!")
            return
        
        print("✅ Knowledge-Eintrag gefunden:")
        print(f"   ID: {entry.id}")
        print(f"   Titel: {entry.title}")
        print(f"   Target Group ID: {entry.target_group_id}")
        print(f"   Content Länge: {len(entry.content)} Zeichen")
        print()
        
        # Check DocumentChunk
        chunk = session.query(DocumentChunk).filter(
            DocumentChunk.knowledge_entry_id == entry.id
        ).first()
        
        if chunk:
            print("✅ DocumentChunk gefunden:")
            print(f"   Chunk ID: {chunk.id}")
            print(f"   Document ID: {chunk.document_id}")
            print(f"   Content Preview: {chunk.content[:100]}...")
            print()
            
            # Check TargetGroupSource
            source = session.query(TargetGroupSource).filter(
                TargetGroupSource.chunk_id == chunk.id,
                TargetGroupSource.target_group_id == entry.target_group_id
            ).first()
            
            if source:
                print("✅ TargetGroupSource gefunden:")
                print(f"   Source ID: {source.id}")
                print(f"   Relevance Score: {source.relevance_score}")
                print(f"   Rationale: {source.rationale}")
                print()
            else:
                print("❌ TargetGroupSource fehlt!")
                print()
            
            # Check Qdrant
            try:
                points = qdrant.retrieve(
                    collection_name="research_chunks",
                    ids=[str(chunk.id)],
                    with_payload=True,
                    with_vectors=False
                )
                if points and len(points) > 0:
                    payload = points[0].payload or {}
                    print("✅ Qdrant Vector gefunden:")
                    print(f"   Point ID: {points[0].id}")
                    print(f"   Source: {payload.get('source')}")
                    print(f"   Knowledge Entry ID: {payload.get('knowledge_entry_id')}")
                    print(f"   Target Group ID: {payload.get('target_group_id')}")
                    print(f"   Vector vorhanden: {points[0].vector is not None}")
                    print()
                    print("🎉 Alle Checks erfolgreich - Knowledge-Eintrag wurde korrekt ingested!")
                else:
                    print("❌ Qdrant Vector fehlt!")
            except Exception as e:
                print(f"❌ Fehler beim Abrufen aus Qdrant: {e}")
                print()
        else:
            print("❌ DocumentChunk fehlt - Ingestion wurde nicht ausgeführt!")
            print(f"   💡 Tipp: Versuche manuell: KnowledgeIngestionService().ingest_knowledge_entry({entry.id})")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        # Find all knowledge entries
        with get_session() as session:
            entries = session.query(TargetGroupKnowledgeEntry).order_by(
                TargetGroupKnowledgeEntry.created_at.desc()
            ).limit(5).all()
            if entries:
                print("Letzte 5 Knowledge-Einträge:")
                for entry in entries:
                    print(f"\n{'='*60}")
                    check_knowledge_entry(str(entry.id))
            else:
                print("Keine Knowledge-Einträge gefunden")
    else:
        search_term = sys.argv[1]
        with get_session() as session:
            # Try as UUID first
            try:
                entry_uuid = UUID(search_term)
                check_knowledge_entry(search_term)
            except ValueError:
                # Search by title or content
                entries = session.query(TargetGroupKnowledgeEntry).filter(
                    (TargetGroupKnowledgeEntry.title.ilike(f'%{search_term}%')) |
                    (TargetGroupKnowledgeEntry.content.ilike(f'%{search_term}%'))
                ).all()
                if entries:
                    for entry in entries:
                        print(f"\n{'='*60}")
                        check_knowledge_entry(str(entry.id))
                else:
                    print(f"Keine Knowledge-Einträge mit '{search_term}' gefunden")

