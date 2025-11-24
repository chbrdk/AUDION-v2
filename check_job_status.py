#!/usr/bin/env python3
from app.db import get_session
from app.models import ProcessingJob
from uuid import UUID

document_id = "1181371d-33ab-4fa5-93dd-584bc40dedf4"

with get_session() as session:
    job = session.query(ProcessingJob).filter(ProcessingJob.document_id == UUID(document_id)).first()
    if job:
        print(f"Job status: {job.status}")
        print(f"Job progress: {job.progress}")
        print(f"Job error: {job.error}")
        print(f"Job updated_at: {job.updated_at}")
    else:
        print("No job found for this document")


