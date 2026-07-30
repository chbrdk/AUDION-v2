# UX Studies / Waves (AUDION-v2)

## API

| Method | Path |
|--------|------|
| GET/POST | `/ux-studies` |
| GET/PATCH | `/ux-studies/{study_id}` |
| POST | `/ux-studies/{study_id}/waves` |
| GET | `/ux-studies/{study_id}/waves/{wave_id}` |
| POST | `/ux-studies/{study_id}/waves/{wave_id}/evaluate` |
| GET | `/ux-studies/{study_id}/waves/{wave_id}/compare/{other_wave_id}` |
| POST | `/ux-studies/{study_id}/waves/{wave_id}/start` |
| POST | `/ux-studies/{study_id}/waves/{wave_id}/sync` |

## Code

| Concern | Path |
|---------|------|
| Models | `apps/api/app/models/__init__.py` → `UxStudy`, `UxStudyWave`, `UxWaveRunItem` |
| Migration | `apps/api/alembic/versions/20260730_ux_studies.py` |
| Schemas | `apps/api/app/ux_study_schemas.py` |
| Store | `apps/api/app/services/ux_study_store.py` |
| Evaluate/Compare | `apps/api/app/services/ux_study_evaluate.py` |
| Orchestration | `apps/api/app/services/ux_study_orchestrate.py` |
| Router | `apps/api/app/routers/ux_studies.py` |
| MCP | `mcp-server/src/tools-ux-studies.ts` |
| Tests | `apps/api/tests/test_ux_studies.py` |
| Legacy compare script | `scripts/compare-ebm-evaluations.py` |
| Default EBM run plan | `knowledge/ebm-produktkombinationen-journey-tasks.json` (incl. Nav + H5 segment) |

## URL keys

See `knowledge/urls.json`:

- `bosch.ebike.produktkombinationen`
- `bosch.ebike.home` (Nav run H3/Q4)
- `audion.uxJourneyAgent.local`
- `audion.api.uxStudies` → `/ux-studies`

## MCP tools

`audion.ux_study_*` · `audion.ux_wave_*` (list/get/create/evaluate/compare/start/sync)

## Evidence gate

`infer_valid_evidence`: hard 403 blockers or `agent_success=false` → invalid; `task_completed` or `goal_reached` → valid (optional caveat).
