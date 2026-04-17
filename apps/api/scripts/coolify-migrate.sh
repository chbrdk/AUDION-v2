#!/usr/bin/env bash
# Run Alembic migrations without opening a Coolify terminal.
# Usage (Docker / Coolify): same env as api service, from app dir:
#   /app/apps/api/scripts/coolify-migrate.sh
# Coolify: optional "Execute Command" on deploy, or one-off job with this script as command.
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
