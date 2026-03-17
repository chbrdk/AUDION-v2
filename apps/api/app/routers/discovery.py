"""
Opal-style discovery endpoint for AUDION.
Enables AUDION to be registered in Opal: Opal (or any client) calls this URL
and receives a list of AUDION API tools/endpoints. Auth: Bearer token optional for discovery.
"""

from __future__ import annotations

from fastapi import APIRouter, Request
from pydantic import BaseModel, Field

router = APIRouter(tags=["discovery"])


class DiscoveredTool(BaseModel):
    id: str = Field(..., description="Unique tool id for Opal/client calls")
    name: str | None = Field(None, description="Human-readable name")
    url: str = Field(..., description="Path (relative to base_url) or absolute URL")
    method: str = Field(..., description="HTTP method")
    description: str | None = Field(None, description="Optional description")


class DiscoveryResponse(BaseModel):
    base_url: str = Field(..., description="Base URL for relative tool URLs")
    tools: list[DiscoveredTool] = Field(..., description="List of AUDION API tools")
    version: str = Field(default="1.0", description="Discovery format version")


def _tools() -> list[DiscoveredTool]:
    return [
        DiscoveredTool(
            id="auth-login",
            name="Login",
            url="/api/auth/login",
            method="POST",
            description="Authenticate and receive Bearer token",
        ),
        DiscoveredTool(
            id="personas-list",
            name="List Personas",
            url="/api/personas",
            method="GET",
            description="List personas (paginated)",
        ),
        DiscoveredTool(
            id="personas-get",
            name="Get Persona",
            url="/api/personas/{persona_id}",
            method="GET",
            description="Get a single persona by id",
        ),
        DiscoveredTool(
            id="target-groups-list",
            name="List Target Groups",
            url="/api/target-groups",
            method="GET",
            description="List target groups (paginated)",
        ),
        DiscoveredTool(
            id="projects-list",
            name="List Projects",
            url="/api/projects",
            method="GET",
            description="List projects (paginated)",
        ),
        DiscoveredTool(
            id="journeys-list",
            name="List Journeys",
            url="/api/journeys",
            method="GET",
            description="List journeys (paginated, optional project_id)",
        ),
        DiscoveredTool(
            id="journeys-get",
            name="Get Journey",
            url="/api/journeys/{journey_id}",
            method="GET",
            description="Get a single journey by id",
        ),
        DiscoveredTool(
            id="chat-message",
            name="Chat Message",
            url="/api/chat/message",
            method="POST",
            description="Send a chat message (Bearer required)",
        ),
        DiscoveredTool(
            id="chat-images-upload",
            name="Upload Chat Image",
            url="/api/chat/images/upload",
            method="POST",
            description="Upload image for chat (Bearer required)",
        ),
    ]


@router.get(
    "/.well-known/discovery",
    response_model=DiscoveryResponse,
    summary="Opal discovery",
    description="Returns AUDION API tools in Opal discovery format. Use this URL when registering AUDION in Opal. Optional: Authorization Bearer token.",
)
async def get_discovery(request: Request) -> DiscoveryResponse:
    base = str(request.base_url).rstrip("/")
    return DiscoveryResponse(
        base_url=base,
        tools=_tools(),
        version="1.0",
    )
