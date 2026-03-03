# AUDION → PLEXON Usage Tracking (Tokens)

Alle nutzungsrelevanten Aufrufe (LLM, Persona-Generierung, Journey-Generierung) werden in AUDION via `report_usage()` an PLEXON gemeldet und dort in Tokens umgerechnet.

## Erfasste Events (report_usage-Aufrufe)

| Event-Type        | Ort / Endpoint | raw_units | Token-Umrechnung (PLEXON) |
|-------------------|----------------|-----------|---------------------------|
| `llm_request`     | POST /ai-assist (Execute) | input_tokens, output_tokens | input + 2×output |
| `llm_request`     | POST /ai-assist/test (Prompt-Test) | input_tokens, output_tokens | input + 2×output |
| `llm_request`     | POST /personas/{id}/ai/pain-points | input_tokens, output_tokens | input + 2×output |
| `llm_request`     | POST /personas/{id}/ai/interests | input_tokens, output_tokens | input + 2×output |
| `llm_request`     | POST /personas/{id}/ai/values | input_tokens, output_tokens | input + 2×output |
| `llm_request`     | POST /personas/{id}/ai/goals | input_tokens, output_tokens | input + 2×output |
| `llm_request`     | POST /journeys/{id}/ai/generate | input_tokens, output_tokens | input + 2×output |
| `persona_generate`| POST /personas/generate | runs: 1 | 150 × runs |
| `persona_generate`| POST /target-groups/{id}/personas/generate | runs: 1 | 150 × runs |
| `journey_generate`| POST /journeys/generate (sync) | runs: 1 | 150 × runs |

## Chat-API (eigenes Service, apps/chat-api)

| Event-Type    | Endpoint / Ort | raw_units | Token (PLEXON) |
|---------------|----------------|-----------|----------------|
| `llm_request` | POST /chat/message (non-stream) | input_tokens, output_tokens | input + 2×output |
| `chat_message`| POST /chat/message/stream (Stream + Tools) | runs: 1 | 80 × runs |
| `chat_message`| POST /voice/stream (Voice-Chat-Stream) | runs: 1 | 80 × runs |

**user_id:** Request-Body enthält optional `user_id` (PLEXON-User-ID oder interne ID). Wenn die Web-App den eingeloggten User mitschickt, wird pro Nachricht/Stream report_usage aufgerufen. Ohne `user_id` wird nicht gemeldet.

- **Web-App (umgesetzt):** `app/chat/page.tsx` (Share-Chat) und `app/admin/chat/page.tsx` (Admin-Chat) senden bei eingeloggtem User `user_id: user?.plexon_user_id ?? user?.id` an `/api/chat/message/stream` bzw. `/api/voice/chat/stream`. `AuthUser` in `auth-provider.tsx` enthält optional `plexon_user_id`.

- **Implementierung:** `apps/chat-api/app/services/usage_report.py` (gleiche Logik wie API), Env: `PLEXON_AUTH_URL`, `PLEXON_SERVICE_SECRET`.
- **PLEXON:** `chat_message` → 80 Tokens pro Run (Stream ohne exakte Token-Zählung).

## Noch nicht erfasst

- **POST /journeys/generate (async)** – Celery-Task; User-ID müsste an den Task übergeben und nach Abschluss report_usage aufgerufen werden (optional später).
- **Insight-Generierung / Persona Discovery** – Falls über eigene Endpoints aufrufbar, gleiches Muster (report_usage mit llm_request oder eigenem Event).
- ~~**Web-App:** Damit Chat/Voice-Usage gezählt wird, muss … `user_id` mitschicken.~~ → Erledigt: Chat- und Admin-Chat-Seiten senden `user_id` aus `useAuth().user` (plexon_user_id oder id).

## Implementierung

- **AUDION API (Python):** `apps/api/app/services/usage_report.py` – `report_usage(user_id, event_type, raw_units, idempotency_key=None)`. Fire-and-forget per Thread.
- **PLEXON:** `lib/usage-conversion.ts` – `tokensFromEvent(eventType, rawUnits)`; API `POST /api/services/usage/events` nimmt `service: "audion"` entgegen.

## User-ID für PLEXON

Es wird bevorzugt `plexon_user_id` des Users verwendet, falls gesetzt; sonst die interne `current_user.id` (String), damit PLEXON den Nutzer zuordnen kann.
