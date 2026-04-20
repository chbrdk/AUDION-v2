from __future__ import annotations

from typing import Any, List, Optional

from pydantic import BaseModel, Field


class ResearchClaim(BaseModel):
    text: str = Field(..., description="Claim text in the section language.")
    citations: List[str] = Field(default_factory=list, description="List of source URLs supporting the claim.")
    confidence: float | None = Field(default=None, description="Optional 0-1 confidence for the claim.")


class ResearchSection(BaseModel):
    summary: str | None = Field(default=None, description="Short section summary.")
    claims: List[ResearchClaim] = Field(default_factory=list)


class ProjectResearchSummaryV1(BaseModel):
    version: str = Field(default="v1")
    company_overview: ResearchSection = Field(default_factory=ResearchSection)
    offerings: ResearchSection = Field(default_factory=ResearchSection)
    industries: ResearchSection = Field(default_factory=ResearchSection)
    icp_hypotheses: ResearchSection = Field(default_factory=ResearchSection)
    buying_roles: ResearchSection = Field(default_factory=ResearchSection)
    objections: ResearchSection = Field(default_factory=ResearchSection)
    proof_points: ResearchSection = Field(default_factory=ResearchSection)
    terminology: ResearchSection = Field(default_factory=ResearchSection)
    meta: dict[str, Any] = Field(default_factory=dict, description="Model/run metadata (non-user-facing).")


class ProjectResearchStartRequest(BaseModel):
    seed_url: str = Field(..., description="Public http(s) URL to crawl for research.")
    max_pages: int | None = Field(default=None, ge=1, le=50)
    max_depth: int | None = Field(default=None, ge=0, le=4)


class ProjectResearchRunStatusResponse(BaseModel):
    run_id: str
    status: str
    error: Optional[str] = None
    pages_fetched: int = 0
    pages_total_cap: int | None = None
    started_at: Optional[str] = None
    finished_at: Optional[str] = None


class ProjectResearchLatestResponse(BaseModel):
    run_id: str
    status: str
    summary_en: dict[str, Any]
    summary_de: dict[str, Any] | None = None
    citations: dict[str, Any] | None = None
    created_at: str | None = None

