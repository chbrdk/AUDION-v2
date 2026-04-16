# Persona chat: standard vs extended replies

## Behaviour

- **`infer_reply_mode`** (`apps/chat-api/app/utils/reply_mode.py`) classifies the latest user message as `standard` or `extended` using length (≥200 chars), multiple `?`, or analytical keywords (EN/DE).
- **Standard**: short, conversational instructions; `chat_reasoning_effort_standard` (default `none`).
- **Extended**: richer structure / markdown allowed; `chat_reasoning_effort_extended` (default `low`).
- **SSE**: main text uses `type: "delta"`; optional model reasoning uses `type: "reasoning_delta"` (backward compatible).
- **Buffered JSON** (`POST /chat/message`): `reasoning` field when reasoning deltas were present.

## Configuration

Env via `Settings` in `apps/chat-api/app/core/config.py`: `chat_reasoning_effort_standard`, `chat_reasoning_effort_extended`.

## UI

Share chat and admin chat accumulate `reasoning_delta` into `message.reasoning`; `MsqdxGlassChatPanel` shows a collapsible section (`chat.reasoningSection` in locales).
