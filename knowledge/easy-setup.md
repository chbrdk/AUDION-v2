# AI easy setup (`POST /projects/bootstrap`)

## Endpoint

- **Method / path:** `POST /projects/bootstrap`
- **Auth:** Bearer JWT (same as other project routes)
- **Request body (JSON):** `customer_name`, `about`, optional `website_url`, optional `project_name`
- **Behavior:** Creates project (with `description` + `company_context`), seeds AI templates, calls OpenAI for target-group suggestions (first suggestion wins), creates target group, runs persona generation for that group (uses target-group description when no chunks exist).

## Website fetch (optional)

- Implemented in `apps/api/app/services/easy_setup_url.py`
- Config: `EASY_SETUP_URL_FETCH_TIMEOUT_SECONDS`, `EASY_SETUP_URL_MAX_RESPONSE_BYTES`, `EASY_SETUP_URL_MAX_TEXT_CHARS` in `apps/api/app/core/config.py`
- SSRF guard: only `http`/`https`, blocks private/link-local hosts

## Web UI

- Route: `/admin/setup` (`ADMIN_ROUTES.setup` in `apps/web/lib/routes.ts`)
- API path constant: `API_ROUTES.projectsBootstrap` in `apps/web/lib/api-routes.ts`

## Tests

Bootstrap API tests (mock LLM + persona generation):

```bash
cd apps/api
rm -f tests_project_bootstrap.db
DATA_DIR=/tmp/audion-test-uploads \
DATABASE_URL=sqlite:///./tests_project_bootstrap.db \
REDIS_URL=redis://localhost:6379/0 \
AUTH_JWT_SECRET=test-jwt \
OPENAI_API_KEY=test \
python3 -m pytest -q tests/test_project_bootstrap.py
```

E2E: `tests/e2e/test_easy_setup.spec.ts` (requires full web install including `@msqdx/react` for Playwright webServer).

## Related DB / dev notes

- SQLite-backed local pytest needs a **file** DB URL (not `:memory:`) so `TestClient` shares schema with the app module.
- `schema_translate_map` maps `audion` schema to default for SQLite DDL in `apps/api/app/db.py`.
