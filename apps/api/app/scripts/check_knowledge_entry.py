"""
Quick script to check if a knowledge entry was ingested correctly.
"""
from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / "app"))

from uuid import UUID

from app.db import get_session
from app.models import DocumentChunk, TargetGroupKnowledgeEntry, TargetGroupSource

def check_knowledge_entry(entry_id: str) -> None:
    with get_session() as session:
        entry = session.query(TargetGroupKnowledgeEntry).filter(
            TargetGroupKnowledgeEntry.id == UUID(entry_id)
        ).first()
        
        if not entry:
            print(f"❌ Knowledge-Eintrag {entry_id} nicht gefunden!")
            return
        
        print(f"✅ Knowledge-Eintrag gefunden: {entry.title}")
        print(f"   Target Group ID: {entry.target_group_id}")
        print(f"   Content Länge: {len(entry.content)} Zeichen")
        
        # Check DocumentChunk
        chunk = session.query(DocumentChunk).filter(
            DocumentChunk.knowledge_entry_id == entry.id
        ).first()
        
        if chunk:
            print(f"✅ DocumentChunk gefunden: {chunk.id}")
            
            # Check TargetGroupSource
            source = session.query(TargetGroupSource).filter(
                TargetGroupSource.chunk_id == chunk.id,
                TargetGroupSource.target_group_id == entry.target_group_id
            ).first()
            
            if source:
                print(f"✅ TargetGroupSource gefunden: relevance_score={source.relevance_score}")
            else:
                print("❌ TargetGroupSource fehlt!")
        else:
            print("❌ DocumentChunk fehlt - Ingestion wurde nicht ausgeführt!")
            
        # Check Qdrant (via retrieve)
        from qdrant_client import QdrantClient
        from app.core.config import get_settings
        settings = get_settings()
        qdrant = QdrantClient(settings.qdrant_url)
        
        if chunk:
            try:
                points = qdrant.retrieve(
                    collection_name="research_chunks",
                    ids=[str(chunk.id)],
                    with_payload=True,
                    with_vectors=False
                )
                if points and len(points) > 0:
                    payload = points[0].payload or {}
                    print("✅ Qdrant Vector gefunden")
                    print(f"   Payload: source={payload.get('source')}, knowledge_entry_id={payload.get('knowledge_entry_id')}")
                else:
                    print("❌ Qdrant Vector fehlt!")
            except Exception as e:
                print(f"❌ Fehler beim Abrufen aus Qdrant: {e}")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        # Find all knowledge entries with "käse" in title or content
        with get_session() as session:
            entries = session.query(TargetGroupKnowledgeEntry).filter(
                (TargetGroupKnowledgeEntry.title.ilike('%käse%')) |
                (TargetGroupKnowledgeEntry.content.ilike('%käse%'))
            ).all()
            if entries:
                print("Gefundene Knowledge-Einträge mit 'käse':")
                for entry in entries:
                    print(f"  - {entry.id}: {entry.title}")
                    check_knowledge_entry(str(entry.id))
                    print()
            else:
                print("Keine Knowledge-Einträge mit 'käse' gefunden")
    else:
        check_knowledge_entry(sys.argv[1])

