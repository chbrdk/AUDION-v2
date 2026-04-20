#!/bin/bash
set -e
# Don't use set -e here, as it will exit on any error (even non-critical ones)

cd /app/apps/api
export PYTHONPATH=/app/apps/api

# Load .env file if it exists (ignore errors)
if [ -f /app/.env ]; then
  set -a
  . /app/.env 2>/dev/null || true
  set +a
fi

# Check if port 8000 is already in use
# This prevents multiple instances from starting
if command -v nc >/dev/null 2>&1; then
  if nc -z localhost 8000 2>/dev/null; then
    echo "Port 8000 is already in use. Waiting for it to be released..."
    # Wait up to 10 seconds for port to be released
    for i in 1 2 3 4 5 6 7 8 9 10; do
      sleep 1
      if ! nc -z localhost 8000 2>/dev/null; then
        break
      fi
    done
    # If still in use, exit
    if nc -z localhost 8000 2>/dev/null; then
      echo "Port 8000 is still in use. Exiting."
      exit 1
    fi
  fi
elif command -v python3 >/dev/null 2>&1; then
  # Fallback: use Python to check port
  if python3 -c "import socket; s = socket.socket(); s.settimeout(0.1); result = s.connect_ex(('localhost', 8000)); s.close(); exit(0 if result == 0 else 1)" 2>/dev/null; then
    echo "Port 8000 is already in use. Exiting."
    exit 1
  fi
fi

# Run database initialization
echo "Waiting for database to be ready..."
PYTHONPATH=/app/apps/api /app/apps/api/.venv/bin/python3 - <<'PY'
import os
import sys
import time

from sqlalchemy import text

try:
    from app.db import engine
except Exception as exc:
    print(f"Failed to import database engine: {exc}", file=sys.stderr)
    sys.exit(1)

timeout_seconds = int(os.getenv("DB_WAIT_TIMEOUT_SECONDS", "60"))
interval_seconds = float(os.getenv("DB_WAIT_INTERVAL_SECONDS", "2"))
start_time = time.time()

while True:
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        print("Database is ready.")
        break
    except Exception as exc:
        elapsed = time.time() - start_time
        if elapsed >= timeout_seconds:
            print(f"Database not ready after {timeout_seconds}s: {exc}", file=sys.stderr)
            sys.exit(1)
        print("Database not ready yet, retrying...")
        time.sleep(interval_seconds)

PY

# Alembic migrations first (Coolify / Docker: every deploy starts a new container → this always runs).
# Ensures schema matches code (e.g. new columns) before init_db emergency DDL + seed.
echo "Running database migrations (Alembic)..."
if [ -x /app/apps/api/scripts/coolify-migrate.sh ]; then
  /app/apps/api/scripts/coolify-migrate.sh
else
  bash /app/apps/api/scripts/coolify-migrate.sh
fi

echo "Running database initialization..."
PYTHONPATH=/app/apps/api /app/apps/api/.venv/bin/python3 app/scripts/init_db.py

echo "Seeding prompt templates..."
PYTHONPATH=/app/apps/api /app/apps/api/.venv/bin/python3 app/scripts/seed_prompts.py

# Use exec to replace shell with uvicorn process (PID 1)
# This ensures uvicorn is the main process and receives signals correctly
echo "Starting uvicorn..."
exec /app/apps/api/.venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8000
