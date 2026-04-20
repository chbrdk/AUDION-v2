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

## Downstream usage
`POST /projects/{id}/suggest-target-groups` will include the latest research summary (EN JSON) when available, in addition to `project.description` and `project.company_context`.

