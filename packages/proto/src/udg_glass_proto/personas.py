from __future__ import annotations

from typing import Dict, List, Optional

from pydantic import BaseModel


class PersonaTrait(BaseModel):
    label: str
    score: float


class PersonaPainPoint(BaseModel):
    label: str
    evidence_count: int


class PersonaGoal(BaseModel):
    label: str
    priority: int


class PersonaCommunicationStyle(BaseModel):
    vocabulary: List[str]
    sentence_structure: str
    skepticism_level: int


class PersonaProfile(BaseModel):
    id: str
    name: str
    segment: str
    headline: str
    bio: str
    full_name: Optional[str] = None
    age: Optional[int] = None
    location: Optional[str] = None
    interests: List[str] = []
    color_palette: List[str] = []
    attention_span: Optional[str] = None
    social_media_usage: List[str] = []
    values: List[str] = []
    traits: Dict[str, float]
    pain_points: List[PersonaPainPoint]
    goals: List[PersonaGoal]
    communication_style: PersonaCommunicationStyle
    confidence: float
    version: str
    created_at: str


class PersonaPrompt(BaseModel):
    persona_id: str
    system_prompt: str
    template_version: str

