import sys
from uuid import UUID
from sqlalchemy import select, text
from app.db import get_session
from app.models import Document, DocumentChunk, TargetGroupSource, TargetGroup

def check_tg_state(tg_id_str):
    tg_id = UUID(tg_id_str)
    with get_session() as session:
        # Check TG
        tg = session.get(TargetGroup, tg_id)
        if not tg:
            print(f"TargetGroup {tg_id} not found!")
            return

        print(f"TargetGroup found: {tg.name} ({tg.id})")

        # Check Documents
        docs = session.scalars(select(Document).where(Document.target_group_id == tg_id)).all()
        print(f"Documents found: {len(docs)}")
        for doc in docs:
            print(f"  - Doc {doc.id}: status={doc.status}, filename={doc.filename}")

            # Check Chunks for Doc
            chunks = session.scalars(select(DocumentChunk).where(DocumentChunk.document_id == doc.id)).all()
            print(f"    - Chunks: {len(chunks)}")
            if chunks:
                 print(f"    - First chunk ID: {chunks[0].id}")

        # Check TargetGroupSource
        sources = session.scalars(select(TargetGroupSource).where(TargetGroupSource.target_group_id == tg_id)).all()
        print(f"TargetGroupSources found: {len(sources)}")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python app/scripts/check_db_state.py <tg_id>")
        sys.exit(1)
    check_tg_state(sys.argv[1])
