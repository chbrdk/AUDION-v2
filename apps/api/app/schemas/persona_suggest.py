"""Schemas for AI-suggested personas (step 1: basic fields only)."""
from __future__ import annotations

from pydantic import BaseModel, Field


class PersonaSuggestionItem(BaseModel):
    """Single persona suggestion: name, age, headline, short bio, location, gender."""

    name: str = Field(..., description="Suggested persona display name.")
    age: str | None = Field(default=None, description="Age or age range (e.g. '32', '25-34').")
    headline: str = Field(..., description="Short headline summarizing role or focus.")
    bio: str = Field(default="", description="Short biography or description.")
    location: str | None = Field(default=None, description="Location or region.")
    gender: str | None = Field(default=None, description="Gender (e.g. 'female', 'male', 'diverse').")


class SuggestPersonasRequest(BaseModel):
    """Optional body for suggest-personas endpoint."""

    max_suggestions: int = Field(default=5, ge=1, le=10, description="Max number of persona suggestions.")
    include_checkion_topics: bool = Field(
        default=True,
        description="When true and CHECKION is configured, append aggregated Deep Scan page topics to the AI context.",
    )
    output_locale: str | None = Field(
        default=None,
        description='Language for suggested persona copy: "en" | "de".',
    )


class SuggestPersonasResponse(BaseModel):
    """Response containing list of persona suggestions."""

    suggestions: list[PersonaSuggestionItem] = Field(default_factory=list)
