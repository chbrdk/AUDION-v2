# Database connection pool timeout (TimeoutError)

## Problem

`sqlalchemy.exc.TimeoutError: QueuePool limit of size 5 overflow 10 reached, connection timed out, timeout 30.00` means all pool connections were in use and a new request waited 30s for a free connection.

## Configuration

Pool settings are in `apps/api/app/core/config.py` and used in `apps/api/app/db.py`. Defaults (as of fix):

- **database_pool_size**: 10 (number of connections always in the pool)
- **database_pool_max_overflow**: 20 (extra connections when pool is full → max 30 total)
- **database_pool_timeout_seconds**: 30 (how long to wait for a free connection)
- **database_pool_recycle_seconds**: 600 (recycle connections after 10 min to avoid stale ones)

## Override via environment

In Coolify or `.env`:

- `DATABASE_POOL_SIZE=15`
- `DATABASE_POOL_MAX_OVERFLOW=25`
- `DATABASE_POOL_TIMEOUT_SECONDS=45`
- `DATABASE_POOL_RECYCLE_SECONDS=300`

Increase pool size if you run multiple API workers or see timeouts under load. Ensure PostgreSQL `max_connections` is high enough for (pool_size + max_overflow) × number of API instances.
