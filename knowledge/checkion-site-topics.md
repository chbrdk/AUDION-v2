# CHECKION site topics (AUDION)

## Endpoint

- **GET** `/projects/{project_id}/integrations/checkion/site-topics`
- **Query:** `seed_url` (optional), `max_pages` (default 400, max 2000)
- **Auth:** Bearer; caller must be a project member (same pattern as other project routes).
- **Response:** `CheckionSiteTopicsResponse` — `scan_id`, `source` (`checkion_project` | `by_domain`), `topics[]` (`tag`, `page_count`, `weight_sum`, `median_score`), `pages_processed`, `truncated`, `seed_url_used`, `unavailable_reason`.

When CHECKION is not configured or no seed/scan is available, the API still returns **HTTP 200** with an empty `topics` list and `unavailable_reason` set (e.g. `checkion_not_configured`, `no_seed_url`, `no_scan_or_empty_slim_pages`) so the admin UI can show a clear empty state.

## Seed URL resolution

1. Explicit `seed_url` query parameter if provided.
2. Otherwise the latest **succeeded** `ProjectResearchRun.seed_url` for the project.
3. If none **and** the project has no `checkion_project_id`: empty topics and `unavailable_reason=no_seed_url`.
4. If there is a linked **`checkion_project_id`**, the server resolves the latest scan via CHECKION `GET /api/projects/{id}/domain-summary` and does **not** require a research seed URL (hostname / by-domain is only used as fallback when the linked path is missing or returns no scan).

## Aggregation limits

- Slim-pages fetch is capped by `max_pages` (default 400).
- Topic list is capped at **30** tags; `truncated` is true if either the tag list was capped or the slim-page fetch hit the page cap.

## Prompt usage

Suggest target groups and suggest personas append an optional block built by `build_optional_checkion_topics_prompt_block` when `include_checkion_topics` is true (default). The block is labelled **CHECKION_SITE_TOPICS** and is treated as scanner metadata, not verified facts. Prompt text is hard-limited (see `format_checkion_site_topics_for_prompt`).

## Web

BFF path is under `/api/projects/...` (see `apps/web/lib/api-routes.ts` → `projectCheckionSiteTopics`). The project admin panel loads this when the **Site topics (CHECKION)** section is expanded.
