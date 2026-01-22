#!/bin/sh
set -e

cd /app/apps/chat-api
export PYTHONPATH=/app/apps/chat-api
exec /app/apps/chat-api/.venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8001

