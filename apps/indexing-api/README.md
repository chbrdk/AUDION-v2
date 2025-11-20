# Indexing API

Document upload and processing service for Dynamic Persona Chat.

## Features

- Document upload (PDF, DOCX, TXT)
- Async processing with Celery
- Text chunking and embedding generation
- Vector storage in Qdrant
- Local file storage

## Endpoints

- `POST /upload` - Upload a document
- `GET /jobs/{job_id}/status` - Get processing job status
- `GET /health` - Health check
- `GET /health/ready` - Readiness check

## Environment Variables

- `DATA_DIR` - Directory for storing uploaded files (default: `./data/uploads`)
- `DATABASE_URL` - PostgreSQL connection string
- `REDIS_URL` - Redis connection string for Celery
- `QDRANT_URL` - Qdrant vector database URL

