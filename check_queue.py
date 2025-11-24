#!/usr/bin/env python3
from app.core.config import get_settings
from redis import Redis

r = Redis.from_url(get_settings().redis_url)
pending = r.llen('ingestion')
print(f'Pending tasks in ingestion queue: {pending}')

if pending > 0:
    task = r.lindex('ingestion', 0)
    print(f'First task (first 200 chars): {task[:200].decode() if task else None}')


