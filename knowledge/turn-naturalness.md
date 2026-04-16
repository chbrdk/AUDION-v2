# Turn naturalness (Persona-Chat)

## Zweck

[`apps/chat-api/app/utils/turn_naturalness.py`](../apps/chat-api/app/utils/turn_naturalness.py) liefert pro Anfrage ein **deutschsprachiges System-Addendum** (Länge, Du/Sie, optional sehr sparsame „Menschlichkeit“) und einen effektiven **`reply_mode`** (`standard` / `extended`), kompatibel mit [`reply_mode.py`](../apps/chat-api/app/utils/reply_mode.py) und `EXTENDED_SYSTEM_ADDENDUM`.

Zentrale Zusammenführung des System-Prompts: **`compose_persona_system_prompt`** (Basis → optional engl. Extended-Hinweis → deutsch Naturalness).

## Konfiguration (Settings)

| Feld | Bedeutung |
|------|-----------|
| `chat_extended_min_chars` | Mindestlänge der Nutzernachricht (Zeichen) für „extended“ (wie `infer_reply_mode`). Default: 200. |
| `turn_naturalness_max_imperfections_per_session` | Max. Anzahl Imperfection-Hinweise pro Session (WS oder HTTP mit `session_id`). Default: 3. |
| `turn_naturalness_imperfection_probability` | Wenn Budget und Turn-Bedingung passen: mit dieser Wahrscheinlichkeit (0–1) wird der Imperfection-Hinweis injiziert und das Budget verbraucht. `0` = nie, `1` = immer (wie früher deterministisch). Default: 0.35. |
| `turn_naturalness_http_session_ttl_seconds` | In-Memory-HTTP-Sessions ohne Zugriff verwerfen (Default 24h). |
| `turn_naturalness_http_session_max_entries` | Obergrenze Einträge im HTTP-Session-Store (LRU). Default: 50_000. |

## WebSocket: optionale `messages`

Clients können neben `content` ein Array **`messages`** (`{ role, content }[]`) senden — siehe [`ws/chat.py`](../apps/chat-api/app/ws/chat.py). TypeScript-Typen: [`figma-plugin2`](../apps/figma-plugin2/src/api/audion-client.ts) / [`powerpoint-plugin`](../apps/powerpoint-plugin/src/api/audion-client.ts) (`WebSocketMessage.messages`).

## HTTP: `session_id` + Store

[`turn_session_store.py`](../apps/chat-api/app/utils/turn_session_store.py): stabiler **`TurnSessionState`** pro logischer Konversation, wenn der Client **`session_id`** (und optional **`user_id`**) mitschickt — Schlüssel `"{user_id or anon}::{session_id}"`.

- **Admin Web** [`apps/web/app/admin/chat/page.tsx`](../apps/web/app/admin/chat/page.tsx): `session_id` = `currentConversationId` (bestehende Konversations-ID); Target-Group-Runden nutzen `"{conversationId}::tg::{personaId}"` pro Persona.
- **Share Web** [`apps/web/app/chat/page.tsx`](../apps/web/app/chat/page.tsx): `session_id` pro Persona in `sessionStorage` unter `audion-share-chat-session-{personaId}`.

- **Chat** [`chat.py`](../apps/chat-api/app/routers/chat.py): Feld `session_id` auf `ChatMessageRequest`.
- **Voice** [`voice.py`](../apps/chat-api/app/routers/voice.py): Feld `session_id` auf `VoiceChatRequest`.

Am Ende eines **erfolgreichen** SSE-Streams ruft [`chat_stream.py`](../apps/chat-api/app/routers/chat_stream.py) `finalize_turn_session_after_assistant` auf (Assistant-Turn-Zähler). Voice analog nach `complete`.

Ohne `session_id`: zustandslose Heuristik (Du/Sie aus Text), kein Imperfection-Budget (nur allgemeiner Negativhinweis).

## Einstiegspunkte

- **HTTP** `build_chat_stream_context`: letzte/vorletzte User-Nachricht aus `messages`; optional `TurnSessionState` aus Store.
- **SSE** `iter_chat_sse`: Tools + Legacy mit Addendum; Finalize bei erfolgreichem Abschluss.
- **WebSocket** [`ws/chat.py`](../apps/chat-api/app/ws/chat.py): `ConnectionManager.turn_sessions`; optional Payload **`messages`**.
- **Voice**: wie HTTP; `compose_persona_system_prompt` + Finalize.

## Tests

- `tests/test_turn_naturalness.py`, `test_reply_mode.py`, `test_turn_session_store.py`
- `tests/conftest.py` setzt minimale Umgebungsvariablen für `Settings`.
