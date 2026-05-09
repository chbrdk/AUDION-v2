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


class ToolProposedEvent(BaseModel):
    """
    Emitted when an action tool is about to run and the policy requires the
    user to approve first. Frontend shows a confirm CTA on the persona bubble;
    the user's decision flows back via `POST /chat/tool-call/decision/{call_id}`.

    Note: `job_id` is intentionally NOT part of this event — at this point the
    upstream ux-journey-agent has not been called yet. We use a `call_id` that
    is unique per tool invocation in this chat.
    """

    model_config = ConfigDict(extra="allow")

    tool: str = Field(..., description="Tool name (e.g. 'inspect_website').")
    call_id: str = Field(..., description="Per-call id used to route the user decision back.")
    arguments: Dict[str, Any] = Field(default_factory=dict, description="The tool arguments the LLM proposed.")
    prompt_text: Optional[str] = Field(
        default=None,
        description="Human-readable prompt rendered in the confirm UI (e.g. 'Soll ich porsche.de live ansehen?').",
    )


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
    # UX-research scorecard produced by the agent on terminal status (per-
    # category aggregation + Friction/Persona-Fit/Coverage). Optional: older
    # agent builds and steps with no observations return ``None`` and the
    # chat panel just renders the per-step cards as before.
    scorecard: Optional[Dict[str, Any]] = None
