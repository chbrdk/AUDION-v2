from __future__ import annotations

from enum import Enum
from typing import Any, Dict, List, Literal, Optional

from pydantic import BaseModel, Field


class AiProvider(str, Enum):
    """Supported AI providers."""

    ANTHROPIC = "anthropic"
    OPENAI = "openai"


class AiAssistSuggestion(BaseModel):
    """Generic suggestion payload returned by templates."""

    content: str = Field(..., description="Primary textual content of the suggestion.")
    title: Optional[str] = Field(default=None, description="Optional short label/title.")
    type: Optional[str] = Field(default=None, description="Optional category such as action, pain_point, etc.")
    metadata: Dict[str, Any] = Field(default_factory=dict, description="Additional template-specific metadata.")


class AiAssistResponse(BaseModel):
    """Normalized response returned by the AI assist endpoint."""

    template_id: str = Field(..., description="Template that produced the response.")
    provider: AiProvider = Field(..., description="Provider that executed the prompt.")
    model: str = Field(..., description="Concrete model name that was used.")
    suggestions: List[AiAssistSuggestion] = Field(
        default_factory=list, description="Structured suggestions parsed from the LLM output."
    )
    raw_output: str = Field(..., description="Unparsed text returned by the provider.")
    usage: Dict[str, Any] = Field(default_factory=dict, description="Provider specific usage & token metadata.")


class AiAssistRequest(BaseModel):
    """Request schema accepted by the AI assist endpoint."""

    template_id: str = Field(..., description="Identifier of the prompt template to execute.")
    provider: AiProvider | None = Field(
        default=None, description="Optionally override the default provider for the template."
    )
    model: str | None = Field(default=None, description="Override the default model for the template/provider.")
    context: Dict[str, Any] = Field(
        default_factory=dict,
        description="Structured context payload (journey, phase, persona, free-form fields, etc.).",
    )
    prompt_variables: Dict[str, Any] = Field(
        default_factory=dict, description="Additional ad-hoc variables exposed to the template renderer."
    )
    max_suggestions: int | None = Field(
        default=None,
        ge=1,
        le=10,
        description="Optional limit for structured suggestions. Templates can ignore if unsupported.",
    )
    metadata: Dict[str, Any] = Field(
        default_factory=dict,
        description="Caller supplied metadata (e.g., feature name) echoed back for observability.",
    )


class AiTemplateOutputConfig(BaseModel):
    """Configuration that helps the service parse provider output."""

    mode: Literal["json", "text"] = Field(default="text", description="How to interpret the provider response.")
    key: str | None = Field(
        default=None,
        description="For JSON responses, optional key that contains the list of suggestions.",
    )
    item_fields: Dict[str, str] = Field(
        default_factory=dict,
        description="Mapping of suggestion fields to JSON keys (e.g., {'content': 'content', 'type': 'element_type'}).",
    )


class AiTemplateDefinition(BaseModel):
    """Represents a single prompt template declared in YAML/JSON."""

    template_id: str = Field(..., description="Unique template identifier.")
    label: str = Field(..., description="Human readable label for admin UI.")
    description: str = Field(..., description="What this template helps with.")
    category: str = Field(default="general", description="High-level grouping (journey, persona, etc.).")
    tags: List[str] = Field(default_factory=list, description="Searchable tags for filtering in UI.")
    default_provider: AiProvider = Field(default=AiProvider.ANTHROPIC, description="Preferred provider.")
    default_model: str | None = Field(default=None, description="Optional default model for the provider.")
    temperature: float = Field(default=0.6, ge=0.0, le=1.0, description="Temperature passed to the provider.")
    max_tokens: int = Field(default=1024, ge=64, le=4096, description="Maximum tokens requested from the provider.")
    prompt: str = Field(..., description="Prompt body with template variables.")
    output: AiTemplateOutputConfig = Field(
        default_factory=AiTemplateOutputConfig, description="Parsing instructions for the provider output."
    )
    metadata: Dict[str, Any] = Field(
        default_factory=dict, description="Template specific metadata (e.g., sample responses)."
    )


class AiTemplateSummary(BaseModel):
    """Lightweight summary returned by the template catalog endpoint / settings UI."""

    template_id: str
    label: str
    description: str
    category: str
    tags: List[str] = Field(default_factory=list)
    default_provider: AiProvider
    default_model: str | None = None


class AiTemplateUpdateRequest(BaseModel):
    """Request schema for updating a template (all fields optional except template_id)."""

    label: str | None = None
    description: str | None = None
    category: str | None = None
    tags: List[str] | None = None
    default_provider: AiProvider | None = None
    default_model: str | None = None
    temperature: float | None = None
    max_tokens: int | None = None
    prompt: str | None = None
    output: AiTemplateOutputConfig | None = None
    metadata: Dict[str, Any] | None = None


class AiPromptTestRequest(BaseModel):
    """Request schema for testing a custom prompt directly without a template."""

    prompt: str = Field(..., description="The prompt text to test (can include template variables).")
    provider: AiProvider | None = Field(
        default=None, description="AI provider to use (defaults to Anthropic)."
    )
    model: str | None = Field(default=None, description="Model to use (defaults to provider default).")
    context: Dict[str, Any] = Field(
        default_factory=dict,
        description="Context variables to substitute in the prompt.",
    )
    temperature: float = Field(default=0.6, ge=0.0, le=1.0, description="Temperature for the AI model.")
    max_tokens: int = Field(default=1024, ge=64, le=4096, description="Maximum tokens to generate.")


