"""
Local Pydantic event classes for tool-call lifecycle events that the persona
agent emits while a long-running tool (currently only `inspect_website`) is
running.

We intentionally do NOT extend the shared `msqdx_glass_proto` package, since
these events are an internal contract between this service's tool executor and
its SSE writer in `app/routers/chat_stream.py` — and we want to avoid coupling
other services to chat-api-specific concerns.
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional

from pydantic import BaseModel, ConfigDict, Field


class _ToolEventBase(BaseModel):
    """Common shape for tool lifecycle events."""

    # Tools sometimes carry extra fields the SSE forwarder doesn't know about
    # yet (e.g. when we add a second action tool). Keep models forgiving.
    model_config = ConfigDict(extra="allow")

    tool: str = Field(..., description="Tool name as registered in tools.py (e.g. 'inspect_website').")
    job_id: str = Field(..., description="Upstream job id (UUID from ux-journey-agent /run).")


class ToolStartedEvent(_ToolEventBase):
    """Emitted right after a long-running tool acquired its upstream job id."""

    url: Optional[str] = None
    task: Optional[str] = None


class ToolProgressEvent(_ToolEventBase):
    """Emitted on each successful poll of the upstream job."""

    status: str = Field(..., description="Upstream job status, e.g. 'running' or 'complete'.")
    steps: List[Dict[str, Any]] = Field(default_factory=list)
    steps_total: int = 0


class ToolCompletedEvent(_ToolEventBase):
    """Final lifecycle event: the upstream job is done (or timed out)."""

    success: Optional[bool] = None
    video_url: Optional[str] = None
    error: Optional[str] = None
