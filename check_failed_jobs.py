#!/usr/bin/env python3
from app.db import get_session
from app.models import ProcessingJob, Document

with get_session() as session:
    failed_jobs = session.query(ProcessingJob).filter(ProcessingJob.status == "failed").order_by(ProcessingJob.created_at.desc()).limit(3).all()
    print(f"Found {len(failed_jobs)} failed jobs:")
    for j in failed_jobs:
        doc = session.query(Document).get(j.document_id)
        persona_id = str(doc.persona_id) if doc and doc.persona_id else "unknown"
        print(f"  - Job {j.id}: document_id={j.document_id}, persona_id={persona_id}, error={j.error[:100] if j.error else 'None'}")


