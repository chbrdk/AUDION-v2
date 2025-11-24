#!/usr/bin/env python3
from app.core.config import get_settings
from redis import Redis
import json

r = Redis.from_url(get_settings().redis_url)
task_meta = r.get('celery-task-meta-036e14bc-266a-4af5-8973-3bd8ca902daa')
if task_meta:
    meta = json.loads(task_meta)
    print(f'Task status: {meta.get("status")}')
    print(f'Task result: {meta.get("result")}')
    print(f'Task traceback: {meta.get("traceback", "None")[:500] if meta.get("traceback") else "None"}')
else:
    print('Task meta not found - task may still be in queue or not started')


