# Database connection pool timeout (TimeoutError)

## Problem

`sqlalchemy.exc.TimeoutError: QueuePool limit of size 10 overflow 20 reached, connection timed out, timeout 30.00` means all pool connections were in use and a new request waited 30s for a free connection. You see **500 Internal Server Error** on e.g. `GET /personas/:id` because the dependency `get_db()` cannot obtain a connection.

Common cause: the frontend (persona admin panel) sends very many concurrent requests for the same persona (effect re-runs / missing guards). Each request holds one DB connection until the handler finishes.

## Fixes

1. **Frontend**: Deploy the persona admin panel fix so only one load per `selectedId` and no polling storm (see `knowledge/persona-admin-load-failed-fetch.md`).
2. **Backend**: Larger pool and faster return of connections (already applied in code):
   - Defaults increased to **pool_size=15**, **max_overflow=25** (40 connections per worker).
   - `pool_reset_on_return="rollback"` so returned connections are reset and reused quickly.

## Configuration

Pool settings: `apps/api/app/core/config.py` (used in `apps/api/app/db.py`). Current defaults:

- **database_pool_size**: 15
- **database_pool_max_overflow**: 25 (→ max 40 total per worker)
- **database_pool_timeout_seconds**: 30
- **database_pool_recycle_seconds**: 600

## Override via environment

In Coolify or `.env` if you still see timeouts:

- `DATABASE_POOL_SIZE=20`
- `DATABASE_POOL_MAX_OVERFLOW=30`
- `DATABASE_POOL_TIMEOUT_SECONDS=45`
- `DATABASE_POOL_RECYCLE_SECONDS=300`

Ensure PostgreSQL `max_connections` is high enough for (pool_size + max_overflow) × number of API workers.
