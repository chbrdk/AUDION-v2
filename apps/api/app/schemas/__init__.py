from __future__ import annotations

from typing import List

from pydantic import BaseModel
from udg_glass_proto import (
    ChatEvent,
    PersonaProfile,
    PersonaPrompt,
    UploadJobStatus,
)


class DocumentUploadResponse(BaseModel):
    job_id: str


class PersonaGenerateRequest(BaseModel):
    segment: str
    project_id: str
    persona_id: str | None = None


class PersonaResponse(BaseModel):
    profile: PersonaProfile
    prompt: PersonaPrompt
    sources: List[dict]


__all__ = [
    "ChatEvent",
    "PersonaProfile",
    "PersonaPrompt",
    "UploadJobStatus",
    "DocumentUploadResponse",
    "PersonaGenerateRequest",
    "PersonaResponse",
]

