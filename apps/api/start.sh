#!/bin/sh
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
echo "Running database initialization..."
PYTHONPATH=/app/apps/api /app/apps/api/.venv/bin/python3 app/scripts/init_db.py

# Use exec to replace shell with uvicorn process (PID 1)
# This ensures uvicorn is the main process and receives signals correctly
echo "Starting uvicorn..."
exec /app/apps/api/.venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8000

