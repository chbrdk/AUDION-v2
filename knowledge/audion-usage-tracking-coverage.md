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
| `llm_request`     | POST /journeys/generate (sync), sofern Ai Assist Token-Usage liefert | input_tokens, output_tokens | input + 2×output |
| `journey_generate`| POST /journeys/generate (sync, Fallback ohne Token-Usage) | runs: 1 | 150 × runs |
| `llm_request`     | Celery `journey.generate` (async), sofern Usage vorhanden | input_tokens, output_tokens | input + 2×output |
| `journey_generate`| Celery `journey.generate` (async, Fallback) | runs: 1 | 150 × runs |
| `llm_request`     | Celery `journey.analyze_insights` (nach Messungs-Sync / Batch) | input_tokens, output_tokens | input + 2×output; Idempotency `journey_analyze_insights:{journey_id}:{task_id}` |
| `journey_validate`| `POST /journeys/{id}/validate`, `GET /journeys/{id}/validation-report` | `personas` (Anzahl; API aktuell 1 pro Aufruf) | 35 × personas (PLEXON); regelbasierte Validierung, kein LLM |
| `journey_validate`| Celery `journey.validate` (optional `user_id`, sonst `journey.created_by`) | `personas` = len(persona_ids) | 35 × personas; Idempotency `journey_validate:{journey_id}:{task_id}` |
| `llm_request`     | POST /projects/{id}/suggest-target-groups | input_tokens, output_tokens (OpenAI Chat) | input + 2×output |
| `llm_request`     | POST /target-groups/{id}/suggest-personas | input_tokens, output_tokens (OpenAI Chat) | input + 2×output |
| `llm_request`     | POST /projects/{id}/generate-journey | input_tokens, output_tokens (Ai Assist), falls vorhanden | input + 2×output |
| `journey_generate`| POST /projects/{id}/generate-journey (Fallback ohne Token-Usage) | runs: 1 | 150 × runs |

## Chat-API (eigenes Service, apps/chat-api)

| Event-Type    | Endpoint / Ort | raw_units | Token (PLEXON) |
|---------------|----------------|-----------|----------------|
| `llm_request` | POST /chat/message (non-stream) | input_tokens, output_tokens | input + 2×output |
| `chat_message`| POST /chat/message/stream (Stream + Tools) | runs: 1 | 80 × runs |
| `chat_message`| POST /voice/stream (Voice-Chat-Stream) | runs: 1 | 80 × runs |
| `llm_request` | WebSocket `/ws/chat/{id}` – Persona-Discovery-Zweig (ohne gewählte Persona), wenn Client `user_id` mitschickt | input_tokens, output_tokens (Claude Haiku) | input + 2×output |
| `persona_discover` | WS Discovery – Fallback wenn Anthropic keine Usage-Felder liefert | runs: 1 | 75 × runs |
| `retrieval_query` | BGE + Qdrant: `POST /chat/message`, Stream (Legacy), `/voice/stream`, WS (Persona + Discovery), Tool `search_knowledge` / `get_target_group_knowledge`, Journey `generate_journey_from_knowledge`, **AiAssist** Template-Rendering bei `${knowledge:…}` nach `RetrievalAgent.run` (nicht KnowledgeExplorer-only) | `queries` (pro `RetrievalAgent.run` bzw. pro Zähl-Eintrag im Assist-Lauf) | 18 × queries (PLEXON) |

**user_id:** Request-Body enthält optional `user_id` (PLEXON-User-ID oder interne ID). Wenn die Web-App den eingeloggten User mitschickt, wird pro Nachricht/Stream report_usage aufgerufen. Ohne `user_id` wird nicht gemeldet.

- **Web-App (umgesetzt):** `app/chat/page.tsx` (Share-Chat) und `app/admin/chat/page.tsx` (Admin-Chat) senden bei eingeloggtem User `user_id: user?.plexon_user_id ?? user?.id` an `/api/chat/message/stream` bzw. `/api/voice/chat/stream`. `AuthUser` in `auth-provider.tsx` enthält optional `plexon_user_id`.

- **PowerPoint-Add-in:** Nach Login wird `usageUserId` aus der Auth-Response (`user.plexon_user_id ?? user.id`) in den Settings gespeichert und als `user_id` an `POST /api/chat/message` mitgeschickt (`apps/powerpoint-plugin`).

- **Implementierung:** `apps/chat-api/app/services/usage_report.py` (gleiche Logik wie API), Env: `PLEXON_AUTH_URL`, `PLEXON_SERVICE_SECRET`.
- **PLEXON:** `chat_message` → 80 Tokens pro Run (Stream ohne exakte Token-Zählung).

## Async Journey-Generierung

- **POST /journeys/generate** mit `use_async: true`: Celery-Task `journey.generate` meldet nach erfolgreichem Speichern **`llm_request`** (mit Token-Usage von Ai Assist) oder **`journey_generate`** (`runs: 1`) mit Idempotency `journey_generate_async:{journey_id}`, sofern `user_id` nicht `"system"` ist.

## Noch nicht erfasst

- **apps/api** WebSocket: Retrieval + Discovery nur mit `user_id` im Payload (wie chat-api).

**Hinweis:** `POST /projects/{id}/generate-journey` meldet nach erfolgreichem Speichern einmalig mit Idempotency-Key `journey_from_project:{journey_id}` entweder `llm_request` (wenn die Ai-Assist-Antwort Token-Usage enthält) oder `journey_generate` mit `runs: 1`.

## Implementierung

- **AUDION API (Python):** `apps/api/app/services/usage_report.py` – `report_usage(user_id, event_type, raw_units, idempotency_key=None)`. Fire-and-forget per Thread.
- **PLEXON:** `lib/usage-conversion.ts` – `tokensFromEvent(eventType, rawUnits)`; API `POST /api/services/usage/events` nimmt `service: "audion"` entgegen.

## User-ID für PLEXON

Es wird bevorzugt `plexon_user_id` des Users verwendet, falls gesetzt; sonst die interne `current_user.id` (String), damit PLEXON den Nutzer zuordnen kann.
