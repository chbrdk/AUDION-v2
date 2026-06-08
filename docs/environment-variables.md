# Environment Variables Reference

This document lists all environment variables used by AUDION services.

## Overview

AUDION uses environment variables for configuration. In Coolify, these are set in the application's environment variables section.

## Required Variables

### Database Configuration

| Variable | Description | Example | Service |
|----------|-------------|---------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:pass@host:5432/dbname` | api, chat-api, indexing-api |
| `REDIS_URL` | Redis connection string | `redis://host:6379/0` | api, celery-worker, celery-beat |

**Coolify Note**: When using Coolify Database Resources, use the resource name as the host:
- `postgresql://audion:password@audion-postgres:5432/audion`
- `redis://audion-redis:6379/0`

### AI API Keys

| Variable | Description | Required | Service |
|----------|-------------|----------|---------|
| `OPENAI_API_KEY` | OpenAI API key for AI features | Yes | api, chat-api |
| `CLAUDE_API_KEY` | Anthropic Claude API key (optional) | No | api |

## Optional Variables

### Vector & Graph Databases

| Variable | Description | Default | Service |
|----------|-------------|---------|---------|
| `QDRANT_URL` | Qdrant vector database URL | `http://qdrant:6333` | api, chat-api, indexing-api |
| `NEO4J_URI` | Neo4j graph database connection | `bolt://neo4j:7687` | api, chat-api |
| `NEO4J_USER` | Neo4j username | `neo4j` | api, chat-api |
| `NEO4J_PASSWORD` | Neo4j password | (required, no default) | api, chat-api |

### Application Configuration

| Variable | Description | Default | Service |
|----------|-------------|---------|---------|
| `APP_ENV` | Application environment | `production` | All services |
| `NODE_ENV` | Node.js environment | `production` | web |

### Frontend Configuration

| Variable | Description | Default | Service |
|----------|-------------|---------|---------|
| `NEXT_PUBLIC_BASE_PATH` | Next.js base path (empty for root, `/audion` for sub-path) | `` (empty) | web |
| `NEXT_PUBLIC_PERSONA_BACKEND_URL` | Public URL for persona backend API | `http://api:8000` | web |
| `NEXT_PUBLIC_CHAT_API_URL` | Public URL for chat API | `http://chat-api:8001` | web |
| `NEXT_PERSONA_BACKEND_INTERNAL_URL` | Internal URL for persona backend (server-side) | `http://api:8000` | web |
| `MCP_SERVER_URL` | Interne URL des MCP-Servers für Rewrites `/mcp` → MCP (wie bei CHECKION). Z. B. `http://audion-mcp:3100`. | – | web |

### Tavus (video chat / CVI)

| Variable | Description | Default | Service |
|----------|-------------|---------|---------|
| `TAVUS_API_KEY` | Tavus API key for Conversational Video Interface (CVI). When set, admin chat can start video calls with personas that have a Tavus Replica ID. | – | api |
| `TAVUS_API_BASE` | Tavus API base URL. | `https://tavusapi.com` | api |

See [knowledge/tavus-video-chat.md](../knowledge/tavus-video-chat.md) for setup and persona mapping.

### PLEXON (central auth)

| Variable | Description | Service |
|----------|-------------|---------|
| `PLEXON_AUTH_URL` | PLEXON base URL (e.g. `https://plexon.example.com`). When set, login is validated against PLEXON first. | web |
| `PLEXON_SERVICE_SECRET` | Shared secret (same as in PLEXON). Required if `PLEXON_AUTH_URL` is set. | web |
| `PLEXON_SERVICE_SECRET` (API) | Same as above. Required for Persona Backend `POST /auth/plexon-sync`. | api (Persona Backend) |
| `PLEXON_AUTH_URL` (chat-api) | PLEXON base URL. When set, chat/voice usage is reported to PLEXON. | chat-api |
| `PLEXON_SERVICE_SECRET` (chat-api) | Same as above. Required for chat-api usage reporting. | chat-api |
| `NEXT_PUBLIC_PLEXON_REGISTER_URL` | Link to PLEXON registration page (build-time). Shows “Register in PLEXON” on the register page. | web |

**Note**: In Docker Compose/Coolify, use service names for internal URLs:
- `http://api:8000` (not `http://localhost:8000`)
- `http://chat-api:8001` (not `http://localhost:8001`)

### CHECKION (Project AI Research enrichment)

When both are set, the persona-api Celery worker calls CHECKION after the crawl to attach **per-page Deep Scan metadata** (e.g. `pageClassification`) to matching source URLs before synthesis. If CHECKION is unreachable or returns no scan, research continues with crawl text only.

| Variable | Description | Default | Service |
|----------|-------------|---------|---------|
| `CHECKION_API_BASE_URL` | CHECKION Next.js origin (no trailing slash), e.g. `http://checkion:3000` or `https://checkion.example.com` | – | api, celery-worker |
| `CHECKION_API_TOKEN` | CHECKION API Bearer token (`checkion_` + 64 hex). Must belong to the CHECKION user under whom Deep Scans for target domains were run. | – | api, celery-worker |
| `CHECKION_REQUEST_TIMEOUT_SECONDS` | HTTP timeout for CHECKION calls | `30` | api, celery-worker |

### CHECKION inbound (AUDION → CHECKION audience export for reports)

When set, CHECKION comprehensive reports can call AUDION to load linked personas (`projects.checkion_project_id`).

| Variable | Description | Default | Services |
|----------|-------------|---------|----------|
| `CHECKION_INBOUND_SERVICE_TOKEN` | Bearer token CHECKION sends when fetching audience report | – | api |

See CHECKION repo `knowledge/checkion-audion-audience-report.md`.

See [knowledge/project-ai-research.md](../knowledge/project-ai-research.md) (CHECKION section).

### Service URLs

| Variable | Description | Default | Service |
|----------|-------------|---------|---------|
| `INDEXING_API_URL` | Indexing API internal URL | `http://indexing-api:8000` | chat-api |

## Service-Specific Variables

### Web Service

```bash
NODE_ENV=production
NEXT_PUBLIC_BASE_PATH=
NEXT_PUBLIC_PERSONA_BACKEND_URL=http://api:8000
NEXT_PUBLIC_CHAT_API_URL=http://chat-api:8001
NEXT_PERSONA_BACKEND_INTERNAL_URL=http://api:8000
# Optional: wenn MCP unter gleicher Domain erreichbar sein soll (wie CHECKION)
MCP_SERVER_URL=http://audion-mcp:3100
```

### API Service

```bash
DATABASE_URL=postgresql://audion:password@audion-postgres:5432/audion
REDIS_URL=redis://audion-redis:6379/0
QDRANT_URL=http://qdrant:6333
NEO4J_URI=bolt://neo4j:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=your-neo4j-password
OPENAI_API_KEY=sk-proj-...
CLAUDE_API_KEY=sk-ant-...  # Optional
APP_ENV=production
# Optional: CHECKION Deep Scan metadata for Project AI Research
# CHECKION_API_BASE_URL=http://checkion:3000
# CHECKION_API_TOKEN=checkion_...
```

### Chat API Service

```bash
DATABASE_URL=postgresql://audion:password@audion-postgres:5432/audion
QDRANT_URL=http://qdrant:6333
NEO4J_URI=bolt://neo4j:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=your-neo4j-password
OPENAI_API_KEY=sk-proj-...
INDEXING_API_URL=http://indexing-api:8000
APP_ENV=production
```

### Indexing API Service

```bash
DATABASE_URL=postgresql://audion:password@audion-postgres:5432/audion
QDRANT_URL=http://qdrant:6333
APP_ENV=production
```

### Celery Worker Service

```bash
DATABASE_URL=postgresql://audion:password@audion-postgres:5432/audion
REDIS_URL=redis://audion-redis:6379/0
QDRANT_URL=http://qdrant:6333
NEO4J_URI=bolt://neo4j:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=your-neo4j-password
OPENAI_API_KEY=sk-proj-...
CLAUDE_API_KEY=sk-ant-...  # Optional
APP_ENV=production
# Optional: same CHECKION vars as API if workers run Project AI Research
# CHECKION_API_BASE_URL=http://checkion:3000
# CHECKION_API_TOKEN=checkion_...
```

### Celery Beat Service

```bash
DATABASE_URL=postgresql://audion:password@audion-postgres:5432/audion
REDIS_URL=redis://audion-redis:6379/0
APP_ENV=production
```

## Coolify-Specific Configuration

### Database Resources

When using Coolify Database Resources:

1. **PostgreSQL Resource**:
   - Resource name: `audion-postgres` (or your chosen name)
   - Connection: `postgresql://[username]:[password]@[resource-name]:5432/[database]`
   - Example: `postgresql://audion:mypassword@audion-postgres:5432/audion`

2. **Redis Resource**:
   - Resource name: `audion-redis` (or your chosen name)
   - Connection: `redis://[resource-name]:6379/0`
   - Example: `redis://audion-redis:6379/0`

### Internal Service Communication

In Docker Compose/Coolify, services communicate using service names:

- `api` → Backend API service
- `chat-api` → Chat API service
- `indexing-api` → Indexing API service
- `qdrant` → Qdrant vector database
- `neo4j` → Neo4j graph database

**Important**: Use service names, not `localhost` or `127.0.0.1` in internal URLs.

## Environment Variable Templates

### Local Development (.env files)

Create `.env` files in each service directory:

**apps/api/.env**:
```bash
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/audion
REDIS_URL=redis://localhost:6379/0
QDRANT_URL=http://localhost:6333
NEO4J_URI=bolt://localhost:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=password
OPENAI_API_KEY=sk-proj-...
CLAUDE_API_KEY=sk-ant-...
APP_ENV=development
```

**apps/chat-api/.env**:
```bash
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/audion
QDRANT_URL=http://localhost:6333
NEO4J_URI=bolt://localhost:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=password
OPENAI_API_KEY=sk-proj-...
INDEXING_API_URL=http://localhost:8000
APP_ENV=development
```

### Production (Coolify)

Set all variables in Coolify's environment variables section. Use Database Resource names for database connections.

## Validation

### Required Variables Check

Before deployment, ensure all required variables are set:

```bash
# Check API service
docker-compose exec api python -c "from app.core.config import settings; print('DATABASE_URL:', bool(settings.database_url))"

# Check environment variables
docker-compose exec api env | grep -E "(DATABASE_URL|REDIS_URL|OPENAI_API_KEY)"
```

### Connection Testing

Test database connections:

```bash
# PostgreSQL
docker-compose exec api python -c "from app.db import engine; engine.connect(); print('PostgreSQL: OK')"

# Redis
docker-compose exec api python -c "import redis; r = redis.from_url('$REDIS_URL'); r.ping(); print('Redis: OK')"
```

## Security Notes

1. **Never commit `.env` files** to version control
2. **Use strong passwords** for database resources
3. **Rotate API keys** regularly
4. **Use secrets management** in production (Coolify handles this)
5. **Limit access** to environment variables to authorized personnel

## Troubleshooting

### Variable Not Found

**Problem**: Service fails with "environment variable not set" error.

**Solution**:
1. Verify variable is set in Coolify environment variables
2. Check variable name spelling (case-sensitive)
3. Ensure variable is available to the specific service
4. Restart the service after adding variables

### Incorrect Database Connection

**Problem**: Database connection errors.

**Solution**:
1. Verify `DATABASE_URL` format is correct
2. Check database resource is running
3. Ensure username/password are correct
4. Verify network connectivity between services

### Service Communication Issues

**Problem**: Services can't communicate with each other.

**Solution**:
1. Use Docker Compose service names (not `localhost`)
2. Verify services are on the same network
3. Check service names match `docker-compose.yml`

## Additional Resources

- [Coolify Deployment Guide](deployment/coolify.md)
- [AUDION README](../README.md)
