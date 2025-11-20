# Persona API

FastAPI + Celery backend powering the Dynamic Persona Chat experience. It ingests user research, enriches content, writes to Qdrant/Neo4j, discovers personas during chat, and streams persona responses with citations.

## Key services

- **Document ingestion** – async pipeline orchestrated via Celery + Redis + PostgreSQL metadata.
- **Persona discovery** – retrieval + graph fan-out + Claude Sonnet prompts.
- **Realtime chat** – FastAPI WebSocket gateway streaming `@udg-glass/types` events.
- **Observability** – OpenTelemetry (Tempo) + Logfire structured logs.

## Commands

```bash
uv sync            # install
uv run fastapi dev app/main.py --port 8000
uv run celery -A worker.ingest worker -l INFO
uv run pytest
```

