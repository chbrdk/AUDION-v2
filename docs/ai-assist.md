# AI Assist Architecture

## Overview
The AI Assist platform centralises all LLM-powered authoring across the workspace. Backends expose a generic `/ai-assist` endpoint that executes prompt templates via Anthropic or OpenAI, while feature-specific routes (e.g. journeys, personas) provide additional context or guardrails.

## Key Pieces
- **Prompt Templates**: Stored at `apps/api/app/prompts/templates.yaml`. Each entry declares metadata (category, tags), default provider/model, output parsing rules, and the rendered prompt body.
- **Service Layer**: `AiAssistService` (`apps/api/app/services/ai_assist.py`) handles template rendering, provider dispatch, retries, and structured response parsing. It also logs every request (`ai.assist.dispatch`) for observability.
- **Routers**
  - `/ai-assist` – generic execution endpoint + template catalog.
  - `/journeys/{id}/ai/generate` – builds journey-specific context (target group + personas) and proxies to the service.
  - `/personas/{id}/ai/pain-points` – generates additional persona pain points.
  - `/settings/ai/providers` – exposes safe provider configuration state for the admin UI.
- **Frontend SDK**
  - `aiAssistApi` wraps `/ai-assist`.
  - `useAiAssist` hook orchestrates calling generic or feature-specific routes.
  - `MsqdxGlassAiButton` offers a consistent CTA with sparkle icon + template selector.

## Adding a New Template
1. Append a template entry to `templates.yaml` with a unique `template_id`.
2. Define `prompt` text using `$variable` placeholders exposed via request context.
3. Set `output.mode`:`json` for structured responses (provide `key` + `item_fields`) or `text` for free-form copy.
4. Expose the template in the UI (Settings › Prompts) and wire in via `useAiAssist`.

## Provider Configuration
Environment variables (see `apps/api/app/core/config.py`):
- `CLAUDE_API_KEY` – Anthropic credentials.
- `OPENAI_API_KEY` – GPT credentials.
- `AI_DEFAULT_PROVIDER`, `AI_ANTHROPIC_MODEL`, `AI_OPENAI_MODEL` – defaults + fallbacks.

The settings pages (`/admin/settings/providers`) surface configuration health without exposing raw secrets.


