from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, EmailStr, Field


class ProjectCreateRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=128)


class ProjectUpdateRequest(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=128)
    description: str | None = Field(default=None, description="Short project/company description.")
    company_context: str | None = Field(
        default=None,
        description="Company context: industry, products, target markets, tone of voice, etc.",
    )


class ProjectResponse(BaseModel):
    id: str
    name: str
    owner_user_id: str
    description: str | None = None
    company_context: str | None = None
    created_at: datetime
    updated_at: datetime


class ProjectListResponse(BaseModel):
    items: list[ProjectResponse]
    total: int


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


class TargetGroupSuggestionItem(BaseModel):
    name: str
    segment: str
    description: str


class SuggestTargetGroupsResponse(BaseModel):
    suggestions: list[TargetGroupSuggestionItem]
