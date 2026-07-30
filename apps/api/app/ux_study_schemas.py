"""Pydantic schemas for UX Studies / Waves."""

from __future__ import annotations

from typing import Any, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class HypothesisTemplate(BaseModel):
    id: str
    statement: str


class UxStudyCreate(BaseModel):
    name: str
    status: str = "draft"
    description: Optional[str] = None
    project_id: Optional[UUID] = None
    source_guide: Optional[str] = None
    target_url_key: Optional[str] = None
    hypothesis_templates: list[HypothesisTemplate] = Field(default_factory=list)


class UxStudyPatch(BaseModel):
    name: Optional[str] = None
    status: Optional[str] = None
    description: Optional[str] = None
    project_id: Optional[UUID] = None
    source_guide: Optional[str] = None
    target_url_key: Optional[str] = None
    hypothesis_templates: Optional[list[HypothesisTemplate]] = None


class UxWaveRunItemIn(BaseModel):
    run_key: str
    url: str
    task: str
    leitfaden_block: Optional[str] = None
    persona_id: Optional[UUID] = None
    persona_name: Optional[str] = None
    segment: Optional[str] = None
    max_steps: Optional[int] = None
    job_id: Optional[str] = None
    agent_status: Optional[str] = None
    agent_success: Optional[bool] = None
    task_completed: Optional[bool] = None
    valid_evidence: Optional[bool] = None
    valid_evidence_caveat: Optional[str] = None
    blockers: list[str] = Field(default_factory=list)
    steps: Optional[int] = None
    friction_score: Optional[float] = None
    persona_fit_score: Optional[float] = None
    goal_reached: Optional[bool] = None
    finding: Optional[str] = None
    categories: dict[str, Any] = Field(default_factory=dict)


class UxWaveCreate(BaseModel):
    wave_key: str
    status: str = "draft"
    runs: list[UxWaveRunItemIn] = Field(default_factory=list)


class UxWaveRunItemOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    run_key: str
    leitfaden_block: Optional[str] = None
    persona_id: Optional[UUID] = None
    persona_name: Optional[str] = None
    segment: Optional[str] = None
    url: str
    task: str
    max_steps: Optional[int] = None
    job_id: Optional[str] = None
    agent_status: Optional[str] = None
    agent_success: Optional[bool] = None
    task_completed: Optional[bool] = None
    valid_evidence: Optional[bool] = None
    valid_evidence_caveat: Optional[str] = None
    blockers: list[str] = Field(default_factory=list)
    steps: Optional[int] = None
    friction_score: Optional[float] = None
    persona_fit_score: Optional[float] = None
    goal_reached: Optional[bool] = None
    finding: Optional[str] = None
    categories: dict[str, Any] = Field(default_factory=dict)


class UxWaveSummaryOut(BaseModel):
    id: UUID
    wave_key: str
    status: str
    study_id: UUID
    run_count: int = 0
    valid_evidence_count: int = 0
    updated_at: Optional[str] = None


class UxWaveDetailOut(UxWaveSummaryOut):
    evaluation: Optional[dict[str, Any]] = None
    runs: list[UxWaveRunItemOut] = Field(default_factory=list)


class UxStudySummaryOut(BaseModel):
    id: UUID
    name: str
    status: str
    project_id: Optional[UUID] = None
    source_guide: Optional[str] = None
    target_url_key: Optional[str] = None
    wave_count: int = 0
    updated_at: Optional[str] = None


class UxStudyDetailOut(UxStudySummaryOut):
    description: Optional[str] = None
    hypothesis_templates: list[HypothesisTemplate] = Field(default_factory=list)
    waves: list[UxWaveSummaryOut] = Field(default_factory=list)


class UxStudyListOut(BaseModel):
    items: list[UxStudySummaryOut]
    total: int
    page: int = 1
    page_size: int = 50
