# Persona Chat Prompt (Compact)

## Overview

The **compact chat prompt** is a shortened, specialized system prompt built from persona profile data. It tells the LLM how to behave as the persona: identity, views, tone, vocabulary, and brevity. No extra AI calls are used; the prompt is assembled from existing profile fields.

## Template Version

- **Version**: `2025-03-compact`
- **Constant**: `CHAT_PROMPT_TEMPLATE_VERSION` in `apps/api/app/services/persona_prompt_builder.py`

## When the Prompt Is Ensured

1. **On persona selection for chat**  
   When a user selects a persona (or a target group) for chat, the frontend calls `POST /api/personas/{persona_id}/ensure-chat-prompt` for the selected persona(s). The main API builds the compact prompt from the current profile if missing or if the stored prompt is not the current template version, and saves it.

2. **After enrichment**  
   When `POST /personas/{id}/enrich` runs, a compact prompt is built from the merged profile and saved as part of the same update.

## Builder

- **Module**: `apps/api/app/services/persona_prompt_builder.py`
- **Function**: `build_compact_chat_prompt(name, segment, headline, profile)`
- **Input**: Persona name, segment, headline, and profile dict (pain_points, goals, values, interests, communication_style, traits, bio).
- **Output**: Single string (German). Long labels are truncated (e.g. 120 chars for pain points/goals).

## API

- **Endpoint**: `POST /personas/{persona_id}/ensure-chat-prompt`
- **Auth**: Same as other persona endpoints (current user, project access).
- **Response**: `{ "ensured": true|false, "prompt_length": number }`
- **Idempotent**: If the latest prompt already has `template_version === "2025-03-compact"`, no new row is created (`ensured: false`).

## Chat-API

- Chat-API loads the **latest** persona prompt by `created_at` descending wherever it reads `PersonaPrompt` (non-streaming and streaming chat, voice, ws/chat). So the most recently saved compact prompt is used for the conversation.

## Frontend

- **Persona mode**: When `activePersonaId` is set, the admin chat page calls ensure-chat-prompt for that persona in the background (with a ref to avoid duplicate calls for the same id).
- **Target group mode**: When `targetGroupPersonas` is loaded, ensure-chat-prompt is called for the first 10 personas in the background.
