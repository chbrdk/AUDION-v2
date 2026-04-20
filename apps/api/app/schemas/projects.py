from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, EmailStr, Field


class ProjectCreateRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=128)
    name_de: str | None = Field(default=None, max_length=128, description="German mirror display name (optional).")
    status: str | None = Field(
        default=None,
        description="Publication lifecycle: draft (default) or published. Published requires DE mirrors where EN text is set.",
    )


class ProjectUpdateRequest(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=128)
    name_de: str | None = Field(
        default=None,
        max_length=128,
        description="German mirror display name (set empty string to clear).",
    )
    description: str | None = Field(default=None, description="Short project/company description.")
    description_de: str | None = Field(
        default=None,
        description="German mirror of description (set empty string to clear).",
    )
    company_context: str | None = Field(
        default=None,
        description="Company context: industry, products, target markets, tone of voice, etc.",
    )
    company_context_de: str | None = Field(
        default=None,
        description="German mirror of company_context (set empty string to clear).",
    )
    status: str | None = Field(
        default=None,
        description="Set to draft or published. Published requires DE mirrors where EN text is set.",
    )
    checkion_project_id: str | None = Field(
        default=None,
        description="CHECKION project UUID to load Deep Scan slim-pages from (set empty string to clear).",
    )


class ProjectResponse(BaseModel):
    id: str
    name: str
    name_de: str | None = None
    owner_user_id: str
    description: str | None = None
    description_de: str | None = None
    company_context: str | None = None
    company_context_de: str | None = None
    status: str = "draft"
    checkion_project_id: str | None = None
    created_at: datetime
    updated_at: datetime


class ProjectListResponse(BaseModel):
    items: list[ProjectResponse]
    total: int


class CheckionProjectItem(BaseModel):
    id: str
    name: str
    domain: str | None = None


class CheckionProjectListResponse(BaseModel):
    items: list[CheckionProjectItem]


class CheckionSiteTopicItem(BaseModel):
    tag: str
    page_count: int
    weight_sum: float
    median_score: float | None = None


class CheckionSiteTopicsResponse(BaseModel):
    scan_id: str | None = None
    source: str | None = Field(default=None, description="checkion_project | by_domain")
    topics: list[CheckionSiteTopicItem] = Field(default_factory=list)
    pages_processed: int = 0
    truncated: bool = False
    seed_url_used: str | None = None
    unavailable_reason: str | None = Field(
        default=None,
        description="null when data ok; otherwise e.g. checkion_not_configured, no_seed_url, no_scan_or_empty_slim_pages, no_tags_in_slim_pages",
    )


class ProjectMemberAddRequest(BaseModel):
    email: EmailStr
    role: str | None = Field(default=None, description="owner, admin, or member")


class ProjectMemberResponse(BaseModel):
    id: str
    user_id: str
    email: EmailStr
    name: str | None = None
    role: str
    status: str
    created_at: datetime


class ProjectDetailResponse(ProjectResponse):
    members: list[ProjectMemberResponse]


class SuggestTargetGroupsRequest(BaseModel):
    max_suggestions: int = 5
    include_project_research: bool = Field(
        default=True,
        description="When true and a latest Project AI Research summary exists, append its EN JSON to the AI context.",
    )
    include_checkion_topics: bool = Field(
        default=True,
        description="When true and CHECKION is configured, append aggregated Deep Scan page topics to the AI context.",
    )
    output_locale: str | None = Field(
        default=None,
        description='Language for AI-generated names/descriptions: "en" | "de". Ignored when bilingual=true.',
    )
    bilingual: bool = Field(
        default=False,
        description="When true, AI returns English canonical fields plus German mirrors (name_de, segment_de, description_de) in one response.",
    )


class TargetGroupSuggestionItem(BaseModel):
    name: str
    segment: str
    description: str
    name_de: str | None = None
    segment_de: str | None = None
    description_de: str | None = None


class SuggestTargetGroupsResponse(BaseModel):
    suggestions: list[TargetGroupSuggestionItem]


class ProjectEasySetupRequest(BaseModel):
    customer_name: str = Field(..., min_length=1, max_length=256, description="Brand or customer name for this project.")
    about: str = Field(
        ...,
        min_length=1,
        max_length=32_000,
        description="What the project is about; combined with optional website text for AI context.",
    )
    website_url: str | None = Field(
        default=None,
        max_length=2048,
        description="Optional public website URL; server fetches and extracts plain text when possible.",
    )
    project_name: str | None = Field(
        default=None,
        min_length=1,
        max_length=128,
        description="Override display name for the project; defaults to customer_name.",
    )
    output_locale: str | None = Field(
        default=None,
        description='UI locale for AI strings: "en" | "de" (aliases accepted by server). '
        "Send from web `useI18n().locale`. Omit: target-group suggest uses server default (de); "
        "persona profile JSON generation defaults to English unless this field is set.",
    )


class ProjectEasySetupTargetGroupSummary(BaseModel):
    id: str
    name: str
    segment: str


class ProjectEasySetupPersonaSummary(BaseModel):
    id: str
    name: str
    segment: str


class ProjectEasySetupResponse(BaseModel):
    project: ProjectResponse
    target_group: ProjectEasySetupTargetGroupSummary
    persona: ProjectEasySetupPersonaSummary
    website_excerpt_included: bool = Field(
        default=False,
        description="True when optional website fetch succeeded and text was merged into context.",
    )
