#!/usr/bin/env bash
# Run Alembic migrations (Coolify / Docker deploy path).
# - Called automatically from start.sh before init_db on every API container start.
# - Can still be run manually: /app/apps/api/scripts/coolify-migrate.sh
# Requires same env as api (DATABASE_URL, etc.). Working directory: apps/api (script cd's there).
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
export PYTHONPATH="${PYTHONPATH:-$ROOT}"

if [[ -x "$ROOT/.venv/bin/alembic" ]]; then
  exec "$ROOT/.venv/bin/alembic" -c "$ROOT/alembic.ini" upgrade head
fi
if command -v alembic >/dev/null 2>&1; then
  exec alembic -c "$ROOT/alembic.ini" upgrade head
fi
exec python3 -m alembic -c "$ROOT/alembic.ini" upgrade head
