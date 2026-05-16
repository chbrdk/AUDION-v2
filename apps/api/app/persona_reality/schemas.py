from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


class SessionRequest(BaseModel):
    persona_id: str = Field(..., examples=["klaus_dortmund"])
    language: Literal["de", "en"] = "de"
    client_id: str | None = None
    environment_overrides: dict[str, str] | None = None


class PersonaSummary(BaseModel):
    id: str
    display_name: str
    short_descriptor: str
    axes: dict[str, str]


class ErrorBody(BaseModel):
    code: str
    message: str
    details: dict | None = None
