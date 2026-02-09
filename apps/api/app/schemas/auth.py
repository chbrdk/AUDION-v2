from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, EmailStr, Field


class AuthRegisterRequest(BaseModel):
    email: EmailStr = Field(..., description="User email address")
    password: str = Field(..., min_length=6, description="Plaintext password")
    name: str | None = Field(default=None, description="Optional display name")


class AuthLoginRequest(BaseModel):
    email: EmailStr = Field(..., description="User email address")
    password: str = Field(..., description="Plaintext password")


class UserResponse(BaseModel):
    id: str
    email: EmailStr
    name: str | None = None
    created_at: datetime


class AuthTokenResponse(BaseModel):
    access_token: str
    token_type: str = Field(default="bearer")
    user: UserResponse
    default_project_id: str | None = None


class AuthMeResponse(BaseModel):
    user: UserResponse
    default_project_id: str | None = None
