from __future__ import annotations

from pydantic import BaseModel
from msqdx_glass_proto import UploadJobStatus


class DocumentUploadResponse(BaseModel):
    job_id: str


__all__ = [
    "DocumentUploadResponse",
    "UploadJobStatus",
]
