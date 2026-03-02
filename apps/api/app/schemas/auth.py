from __future__ import annotations

from datetime import datetime

from typing import Literal

from pydantic import BaseModel, EmailStr, Field, HttpUrl


class AuthRegisterRequest(BaseModel):
    email: EmailStr = Field(..., description="User email address")
    password: str = Field(
        ...,
        min_length=6,
        max_length=72,
        description="Plaintext password",
    )
    name: str | None = Field(default=None, description="Optional display name")
    plexon_user_id: str | None = Field(default=None, description="PLEXON user id when registering via PLEXON login")


class AuthLoginRequest(BaseModel):
    email: EmailStr = Field(..., description="User email address")
    password: str = Field(..., min_length=6, max_length=72, description="Plaintext password")


class AuthPlexonSyncRequest(BaseModel):
    """Body for POST /auth/plexon-sync: link existing user to PLEXON-derived password."""
    plexon_user_id: str = Field(..., min_length=1, description="PLEXON user id")
    email: EmailStr = Field(..., description="User email (must match existing user)")
    name: str | None = Field(default=None, description="Optional display name to update")


class AuthProfileUpdateRequest(BaseModel):
    email: EmailStr | None = Field(default=None, description="Updated email address")
    name: str | None = Field(default=None, max_length=128, description="Display name")
    company: str | None = Field(default=None, max_length=256, description="Company name")
    avatar_url: HttpUrl | None = Field(default=None, description="Avatar image URL")
    locale: Literal["de", "en"] | None = Field(default=None, description="Preferred language")


class AuthPasswordUpdateRequest(BaseModel):
    current_password: str = Field(..., min_length=6, max_length=72)
    new_password: str = Field(..., min_length=6, max_length=72)


class UserResponse(BaseModel):
    id: str
    email: EmailStr
    name: str | None = None
    company: str | None = None
    avatar_url: HttpUrl | None = None
    locale: str | None = None
    plexon_user_id: str | None = None
    created_at: datetime


class AuthTokenResponse(BaseModel):
    access_token: str
    token_type: str = Field(default="bearer")
    user: UserResponse
    default_project_id: str | None = None


class AuthMeResponse(BaseModel):
    user: UserResponse
    default_project_id: str | None = None
