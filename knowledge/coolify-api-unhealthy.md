## Coolify deploy: `api` container becomes `unhealthy` quickly

### Symptom
- Coolify aborts deployment with `dependency failed to start: container api-... is unhealthy`.
- This can happen **within a few seconds**, even if `docker-compose.yml` has a long `healthcheck.start_period`.

### Root cause (typical for AUDION API)
In `apps/api/start.sh` the API previously ran:

- DB wait
- `alembic upgrade head`
- `init_db.py`
- `seed_prompts.py`
- only then started `uvicorn`

If Coolify evaluates container health early, `/health` cannot respond until `uvicorn` is started, so Docker can mark the container unhealthy and Coolify aborts the rollout.

### Fix implemented in repo
`apps/api/start.sh` now:

- starts `uvicorn` immediately (fast `/health`)
- waits until `/health` responds
- then runs DB wait + migrations + init + seeding
- if bootstrap fails, it stops `uvicorn` and exits non-zero

### Notes
- Healthcheck in `docker-compose.yml` is still `http://localhost:8000/health`.
- If you need to tune the initial health window, use env vars:
  - `API_HEALTHWAIT_TIMEOUT_SECONDS` (default 30)
  - `API_HEALTHWAIT_INTERVAL_SECONDS` (default 0.5)

