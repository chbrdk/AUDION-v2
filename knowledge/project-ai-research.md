# Project AI Research (company URL)

## What it is
Project AI Research turns a **single company URL** into a structured research summary that can power better **target group suggestions** and **persona generation**.

This is intentionally **not** a competitor pipeline (V1). It focuses on extracting the company’s own language, offerings, and ICP signals.

## Bilingual storage rules (non-negotiable)
- **English is canonical**: stored in `summary_en` and used as the stable base for downstream features.\n- **German is a mirror**: stored in `summary_de` with the exact same JSON shape.\n- The UI may display German when `locale=de`, but the canonical research remains English to keep storage consistent.

## Data model (DB)
- `audion.project_research_runs`: one run per research execution (queued/running/succeeded/failed)\n- `audion.project_research_sources`: fetched pages (url + extracted text)\n- `audion.project_research_summaries`: structured JSON summary (EN + DE)

## Crawl limits (V1)
Limited internal crawl:\n- Same host/subdomain only\n- Depth <= 2\n- Default cap: 20 pages\n- HTML-only\n- SSRF protections: only public `http(s)` URLs

## Output schema (V1)
The summary JSON is a stable V1 shape with sections:\n- `company_overview`\n- `offerings`\n- `industries`\n- `icp_hypotheses`\n- `buying_roles`\n- `objections`\n- `proof_points`\n- `terminology`\n\nEach section contains `claims[]` with `citations[]` (source URLs).

## API endpoints
- `POST /projects/{project_id}/research/start`\n- `GET /projects/{project_id}/research/status?run_id=...`\n- `GET /projects/{project_id}/research/latest`

## Celery / operations
- The task `project.research.run` is routed to the Celery queue **`research`** (see `apps/api/app/celery_app.py`).
- **If no worker consumes `research`**, runs stay stuck at **`run_queued`** in the UI forever (the API enqueues work, but nothing picks it up).
- **Local Docker Compose**: `celery-worker` must include `research` in `-Q` (same service that runs `app.celery_app`).
- **Coolify / prod**: extend the persona-api Celery worker command override to include `research` (see `knowledge/coolify-deployment.md`).

## Streaming (SSE) progress
To maximize UX for long-running research runs, the UI can connect to a **Server-Sent Events** stream.

- **API**: `GET /projects/{project_id}/research/stream?run_id=...&after=...`
- **Event types** (sent as `event: progress` with a JSON `data:` payload):
  - `run_queued`
  - `run_started`
  - `crawl_start`
  - `page_fetched` (payload includes `url`, optional `depth`, `pages_fetched`)
  - `crawl_done`
  - `synthesize_start` / `synthesize_done`
  - `translate_start` / `translate_done`
  - `summary_saved`
  - `run_failed` (payload includes `error`)
- **Done signal**: when the run is finished and no further events are pending, the server sends `event: done` and closes the stream.
- **Resume**: pass `after=` on reconnect. This can be either:
  - an event UUID, or
  - an ISO timestamp (event `created_at`)

## Data model (events)
Progress events are durable and stored in:

- `audion.project_research_events`: `(run_id, event_type, message, payload, created_at)`

## OpenAI model (persona-api, shared)
Default **`gpt-5.4-mini`** via `ai_openai_model` in `apps/api/app/core/config.py` (override with env **`AI_OPENAI_MODEL`**). Project research synthesis/translation and other OpenAI call sites use this unless a code path passes another model.

## CHECKION Deep Scan (optional enrichment)
If **`CHECKION_API_BASE_URL`** and **`CHECKION_API_TOKEN`** are set on the **persona-api** and **Celery worker**, after the crawl the worker loads slim-pages and merges a JSON-serializable **`checkion_page`** block (e.g. `pageClassification`, `score`, `uxScore`) onto each research source whose URL matches a slim page.

**Resolution order**
1. If the AUDION project has **`checkion_project_id`** (nullable column on `audion.projects`), the worker calls CHECKION **`GET /api/projects/{id}/domain-summary`** to get a **`scanId`**, then paginates **`GET /api/scan/domain/{scanId}/slim-pages`**.
2. Otherwise it falls back to the **seed URL hostname**: **`GET /api/scan/domain/by-domain?domain=…`**, then the same slim-pages pagination.

**Admin UI:** Project settings → **AI Research** includes a dropdown fed by **`GET /integrations/checkion/projects`** (proxied from the web app as **`/api/integrations/checkion/projects`**). Saving updates the project via **`PATCH /projects/{id}`** with **`checkion_project_id`** (empty string clears the link).

**Constraint:** CHECKION only returns scans owned by the **user tied to the API token** (same as CHECKION’s `by-domain` behaviour). Use an **integration user** in CHECKION, run Deep Scans under that user, and put that user’s API token in AUDION env.

If CHECKION is down, misconfigured, or has no scan, research **still succeeds** using crawl text only.

## Downstream usage
`POST /projects/{id}/suggest-target-groups` will include the latest research summary (EN JSON) when available, in addition to `project.description` and `project.company_context`.

## Troubleshooting failed runs
If **pages** reached the crawl cap (e.g. 20) but **status=failed**, the crawl finished; the exception happened in **synthesis (EN)**, **translation (DE)**, or **DB save**. Check `GET /projects/{id}/research/status?run_id=…` field **`error`**, the **`run_failed`** SSE event `payload.error`, column `audion.project_research_runs.error`, and worker logs (`project.research.task.failed`).

### “Empty response text from AI Provider” (synthesis)
With **GPT-5** models, **reasoning tokens** count toward `max_completion_tokens`. A **4096** cap with a **large crawl prompt** can leave **no visible JSON** (`finish_reason=length`). The API uses a higher default for research (`AI_PROJECT_RESEARCH_MAX_COMPLETION_TOKENS`, default **16384**) and passes **`reasoning_effort: low`** for GPT-5. If it still fails, raise **`AI_PROJECT_RESEARCH_MAX_COMPLETION_TOKENS`** further (e.g. 32768) or reduce **`max_pages`** on the run.

