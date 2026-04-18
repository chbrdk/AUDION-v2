# LLM output locale inventory (`output_locale` / UI parity)

Canonical server helper: `finalize_ai_locale_context` and `normalize_output_locale` in `apps/api/app/services/persona_ai_locale.py`. Web should send **`output_locale`** (snake_case on JSON to persona-api) or **`outputLocale`** (camelCase in TS helpers) from **`useI18n().locale`** (`"en"` \| `"de"`).

## Persona API (`apps/api`) — routes that invoke LLMs

| Route / flow | Server uses locale? | Web sends locale? | Notes |
|--------------|---------------------|-------------------|--------|
| `POST /ai-assist` | Yes — `_build_context` + `_enrich_persona_context` | Yes — `use-ai-assist` / admin panels | Template + locale guard footer. |
| `POST /journeys/{id}/ai/generate` | Yes — `finalize_ai_locale_context` in router | Yes — journey editor / phase card | Proxied via Next `persona-backend/.../ai/generate`; body must include `output_locale`. |
| `POST /projects/{id}/suggest-target-groups` | Yes — `suggest_target_groups(..., output_locale)` | Yes — `msqdx-glass-project-admin-panel` | |
| `POST /projects/{id}/generate-journey` | Yes — journey generation service | Yes — project admin | |
| `POST /projects/bootstrap` (easy setup) | Yes — suggest + persona gen | Yes — `MsqdxGlassEasySetupPanel` | `ProjectEasySetupRequest.output_locale`. |
| `POST /target-groups/{id}/suggest-personas` | Yes | Yes — project admin | |
| `POST /target-groups/{id}/personas/generate` | Yes — `PersonaGenerationService.generate` then `_translate_profile_json_en_to_de` when `profile` is English | Persona overview / TG admin / quick-create **omit** `output_locale` → English `profile` + `profile_de` mirror. Pass `output_locale: "de"` only for monolingual German `profile`. |
| `POST /personas/{id}/ai/*` (chips, etc.) | Yes — `_output_locale_from_payload` | Yes — persona admin | |
| `POST /personas/{id}/enrich` | Yes | Yes — admin / proxies | Bilingual merge + `profile_de`. |
| `POST /personas/generate` (project-scoped stub) | Yes — `PersonaGenerateRequest.output_locale` → `PersonaGenerationService.generate` | Example: `app/api/personas/create/actions.ts` — FormData **`project_id`** (required), **`segment`**, optional **`persona_id`**, optional **`output_locale`** (`en` \| `de`); uses **`getServerAuthToken`** + persona backend base URL | Body matches **`PersonaGenerateRequest`** only (no `description` / `filter_mode` here — use target-group generate for that). Omit `output_locale` → **English** profile strings. |
| `POST /personas/.../translate-fields` | N/A (translate pair) | Yes — persona admin | |
| Settings prompt **test** / execute | Uses request `context` | Yes — **PromptBuilder** / **PreviewPanel** use `withOutputLocale(..., useI18n().locale)` on `testPrompt` context | Matches admin UI language. |

## Chat API (`apps/chat-api`)

Separate from persona-admin templates. Reply language is controlled by chat config / session (e.g. default `chat_model` in `apps/chat-api/app/core/config.py`), not `output_locale` on persona-api.

## Defaults worth knowing

- **`normalize_output_locale(None)`** → `"de"` (used by suggest services and Ai-Assist defaults).
- **`persona_generation_output_locale` / `PersonaGenerationService.generate` without `output_locale`** → **`"en"`** for JSON profile strings (canonical EN profile); pass **`"de"`** for German-first generated copy (e.g. DE UI easy setup / TG generate). Implemented in [`apps/api/app/services/persona_generation_prompts.py`](apps/api/app/services/persona_generation_prompts.py).

## Implementation notes

- **Persona chunk excerpts:** Research excerpt strings and `DocumentChunk.content` are read **inside** the same `get_session()` block as chunk loading in [`persona_generation.py`](apps/api/app/services/persona_generation.py) so the ORM session is still open (avoids detached / closed-session use after `session.close()`). Guard: [`apps/api/tests/test_persona_generation_source_nesting.py`](apps/api/tests/test_persona_generation_source_nesting.py).
- **Ai-Assist logging:** `generate()` logs **`ai.assist.prompt_meta`** at INFO (`prompt_chars`, optional truncated `prompt_preview`, `context`). The full rendered prompt is **`ai.assist.prompt_full`** at DEBUG only. Web helper: [`apps/web/lib/ai-output-locale.ts`](apps/web/lib/ai-output-locale.ts) `withOutputLocale` (use at JSON boundaries: persona admin, project admin, journeys/new, `use-ai-assist`, prompt builder test, easy setup, `generateTargetGroupPersona`, `createPersonaAction`). Vitest: [`apps/web/lib/ai-output-locale.test.ts`](apps/web/lib/ai-output-locale.test.ts).
- **Schema smoke:** [`apps/api/tests/test_persona_generate_request_output_locale.py`](apps/api/tests/test_persona_generate_request_output_locale.py) (skipped at collection if `msqdx_glass_proto` missing).
- **Persona generate FormData → JSON:** [`apps/web/lib/persona-generate-api-body.ts`](apps/web/lib/persona-generate-api-body.ts) `parsePersonaGenerateForm` (Vitest: [`persona-generate-api-body.test.ts`](apps/web/lib/persona-generate-api-body.test.ts)).
- **Target-group persona generate JSON:** omit `output_locale` for bilingual default — Vitest: [`apps/web/lib/target-group-persona-generate.test.ts`](apps/web/lib/target-group-persona-generate.test.ts).

## Maintenance

When adding a new **user-visible LLM** endpoint: (1) accept optional `output_locale` on the body, (2) thread into the service that builds prompts, (3) update this table and the web caller.
