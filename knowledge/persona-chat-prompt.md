# Persona Chat Prompt (Compact)

## Overview

The **compact chat prompt** is a shortened, specialized system prompt built from persona profile data. It tells the chat LLM how to behave as the persona: identity, views, tone, vocabulary, and brevity. The prompt is **built by an LLM** from the full profile so all info can be smartly condensed and prioritized; a deterministic fallback is used if the LLM call fails.

## Template Version

- **Version**: `2025-03-llm`
- **Constant**: `CHAT_PROMPT_TEMPLATE_VERSION` in `apps/api/app/services/persona_prompt_builder.py`

## When the Prompt Is Ensured

1. **On persona selection for chat**  
   When a user selects a persona (or a target group) for chat, the frontend calls `POST /api/personas/{persona_id}/ensure-chat-prompt`. The API calls the LLM (template `persona.build_chat_prompt`) with a serialized profile summary; the LLM returns a compact German system prompt, which is saved. On timeout/error, a deterministic `build_compact_chat_prompt` fallback is used.

2. **After enrichment**  
   When `POST /personas/{id}/enrich` runs, the same LLM builder is used on the merged profile; the result is saved as part of the update. Fallback as above.

## Builder

- **Module**: `apps/api/app/services/persona_prompt_builder.py`
- **LLM**: `build_compact_chat_prompt_llm(session, name, segment, headline, profile)` — async, uses template `persona.build_chat_prompt`, input is `build_persona_profile_summary(...)`.
- **Fallback**: `build_compact_chat_prompt(name, segment, headline, profile)` — no AI; deterministic assembly with truncation.
- **Template**: `persona.build_chat_prompt` in `apps/api/app/prompts/templates.yaml` (mode: text, ~600–800 chars target).

## API

- **Endpoint**: `POST /personas/{persona_id}/ensure-chat-prompt`
- **Auth**: Same as other persona endpoints (current user, project access).
- **Response**: `{ "ensured": true|false, "prompt_length": number }`
- **Idempotent**: If the latest prompt already has `template_version === "2025-03-compact"`, no new row is created (`ensured: false`).

## Chat-API

- Chat-API uses the **same database** (same `DATABASE_URL`, `audion` schema) as the main API. It loads the latest persona prompt with `select(PersonaPrompt).where(...).order_by(PersonaPrompt.created_at.desc()).limit(1)` and reads the prompt text **while the session is still active** so the value is not detached.
- Prompt attribute is read safely: `getattr(prompt_row, "system_prompt", None) or getattr(prompt_row, "systemPrompt", None)` so both snake_case and camelCase ORM mappings work.
- If no row exists, `get_persona_prompt(persona_id)` returns a fallback built from persona name/segment/headline. Logs: `chat.prompt.loaded_from_db` (with `prompt_length`, `template_version`) when using DB; `chat.prompt.using_fallback` when using fallback.
- So the most recently saved compact prompt (from ensure-chat-prompt or enrich) is used for the conversation. Ensure the persona has had "Chat-Prompt aktualisieren" or enrichment run at least once so a row exists.

## Frontend

- **Persona mode**: When `activePersonaId` is set, the admin chat page calls ensure-chat-prompt for that persona in the background (with a ref to avoid duplicate calls for the same id).
- **Target group mode**: When `targetGroupPersonas` is loaded, ensure-chat-prompt is called for the first 10 personas in the background.
