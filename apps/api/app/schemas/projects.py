from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, EmailStr, Field


class ProjectCreateRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=128)


class ProjectUpdateRequest(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=128)


class ProjectResponse(BaseModel):
    id: str
    name: str
    owner_user_id: str
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
