# Persona Reality API (/v1) in AUDION

Stand: Juni 2026

## Spec source

Contract and golden fixtures are maintained in the **TIK** repo:

- https://github.com/chbrdk/TIK
- Sync copies under `apps/api/fixtures/persona_reality/` when TIK changes

## Endpoints (Phase 1 stub)

| Method | Path | Status |
|--------|------|--------|
| POST | `/v1/sessions` | Stub — golden config + fresh session id |
| GET | `/v1/sessions/{session_id}` | In-memory store |
| GET | `/v1/personas` | Klaus only |

## Code layout

```
apps/api/app/persona_reality/
  router.py
  service.py
  schemas.py
apps/api/fixtures/persona_reality/
  golden/klaus_dortmund_de.json
  scene_config.v1.schema.json
```

## Tests

```bash
cd apps/api && pytest tests/test_persona_reality_sessions.py -q
```

## Phase 2 next

- PostgreSQL `persona_reality` schema
- Environment matcher
- CHECKION snapshot adapter
- Persist sessions (replace in-memory dict)
