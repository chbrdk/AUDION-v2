from __future__ import annotations

from typing import List

from pydantic import BaseModel, Field


class ThinkingEvent(BaseModel):
    type: str = Field("thinking", frozen=True)
    status: str


class PersonaSummary(BaseModel):
    persona_id: str | None = None
    name: str
    segment: str
    confidence: float


class PersonasDiscoveredEvent(BaseModel):
    type: str = Field("personas_discovered", frozen=True)
    personas: List[PersonaSummary]


class ContentDeltaEvent(BaseModel):
    type: str = Field("content_delta", frozen=True)
    delta: str
    persona_id: str


class SourceEntry(BaseModel):
    chunk_id: str
    document_id: str
    title: str
    confidence: float
    excerpt: str


class SourcesEvent(BaseModel):
    type: str = Field("sources", frozen=True)
    persona_id: str
    sources: List[SourceEntry]


class CompleteEvent(BaseModel):
    type: str = Field("complete", frozen=True)
    persona_id: str
    latency_ms: int


class PersonaSwitchEvent(BaseModel):
    type: str = Field("persona_switch", frozen=True)
    persona_id: str
    name: str


ChatEvent = (
    ThinkingEvent
    | PersonasDiscoveredEvent
    | ContentDeltaEvent
    | SourcesEvent
    | CompleteEvent
    | PersonaSwitchEvent
)

