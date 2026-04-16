# Turn naturalness (Persona-Chat)

## Zweck

[`apps/chat-api/app/utils/turn_naturalness.py`](../apps/chat-api/app/utils/turn_naturalness.py) liefert pro Anfrage ein **deutschsprachiges System-Addendum** (Länge, Du/Sie, optional sehr sparsame „Menschlichkeit“) und einen effektiven **`reply_mode`** (`standard` / `extended`), kompatibel mit [`reply_mode.py`](../apps/chat-api/app/utils/reply_mode.py) und `EXTENDED_SYSTEM_ADDENDUM`.

Zentrale Zusammenführung des System-Prompts: **`compose_persona_system_prompt`** (Basis → optional engl. Extended-Hinweis → deutsch Naturalness).

## Konfiguration (Settings)

| Feld | Bedeutung |
|------|-----------|
| `chat_extended_min_chars` | Mindestlänge der Nutzernachricht (Zeichen) für „extended“ (wie `infer_reply_mode`). Default: 200. |
| `turn_naturalness_max_imperfections_per_session` | Max. Anzahl Imperfection-Hinweise pro **WebSocket**-Session. Default: 3. HTTP ohne Session: keine Imperfection-Zuteilung (nur Negativhinweis). |

## Einstiegspunkte

- **HTTP** [`chat.py`](../apps/chat-api/app/routers/chat.py): `build_chat_stream_context` setzt `reply_mode` und `turn_naturalness_addendum` aus `build_turn_naturalness_spec` (letzte/vorletzte User-Nachricht aus `messages`).
- **SSE** [`chat_stream.py`](../apps/chat-api/app/routers/chat_stream.py): Tools → `PersonaAgent.stream_response` mit Addendum; Legacy → `compose_persona_system_prompt` wie Persona.
- **WebSocket** [`ws/chat.py`](../apps/chat-api/app/ws/chat.py): `ConnectionManager.turn_sessions` hält `TurnSessionState`; optional Payload-Feld **`messages`**: Liste `{role, content}` für Kontext (letzte User-Nachricht für Retrieval/Spec, vorherige für Du/Sie). Ohne `messages` nur `content` wie bisher.
- **Voice** [`voice.py`](../apps/chat-api/app/routers/voice.py): gleiche Spec wie HTTP, System-Prompt über `compose_persona_system_prompt`.

## Tests

- `apps/chat-api/tests/test_turn_naturalness.py`, `tests/test_reply_mode.py`
- `tests/conftest.py` setzt minimale Umgebungsvariablen, damit `Settings` in Unit-Tests lädt.
