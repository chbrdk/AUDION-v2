# AUDION - Persona Intelligence Platform

AUDION is an autonomous persona intelligence platform for creating, managing, and interacting with AI-powered personas. Built with Next.js, FastAPI, and modern AI services.

## 🚀 Quick Start

### Prerequisites

- Docker & Docker Compose
- PostgreSQL 16+ (or use Coolify Database Resource)
- Redis 7.4+ (or use Coolify Database Resource)
- Qdrant (included in Docker Compose)
- Neo4j (included in Docker Compose)

### Local Development

1. **Clone the repository:**
   ```bash
   git clone <repository-url>
   cd AUDION
   ```

2. **Set up environment variables:**
   ```bash
   cp apps/api/env.template apps/api/.env
   cp apps/chat-api/env.template apps/chat-api/.env
   # Edit .env files with your configuration
   ```

3. **Start services:**
   ```bash
   docker-compose up -d
   ```

4. **Run database migrations:**
   ```bash
   docker-compose exec api alembic upgrade head
   ```

5. **Access the application:**
   - Frontend: http://localhost:3000
   - API: http://localhost:8000
   - Chat API: http://localhost:8001
   - Qdrant: http://localhost:6333
   - Neo4j: http://localhost:7474

## 📁 Project Structure

```
AUDION/
├── apps/
│   ├── web/              # Next.js Frontend
│   ├── api/              # FastAPI Backend (Persona Management)
│   ├── chat-api/         # FastAPI Chat Service
│   └── indexing-api/     # Document Processing Service
├── packages/
│   ├── types/            # Shared TypeScript Types
│   └── proto/            # Protocol Buffer Definitions
├── docs/                 # Documentation
│   ├── deployment/       # Deployment Guides
│   └── environment-variables.md
├── infrastructure/       # Infrastructure Configs
├── knowledge/            # Project Knowledge Base
└── docker-compose.yml    # Docker Compose Configuration
```

## 🏗️ Architecture

### Services

- **web**: Next.js frontend application
- **api**: FastAPI backend for persona management, journeys, target groups
- **chat-api**: FastAPI service for persona chat interactions
- **indexing-api**: Document processing and vector indexing
- **celery-worker**: Background job processing
- **celery-beat**: Scheduled task execution
- **qdrant**: Vector database for embeddings
- **neo4j**: Graph database for relationships

### Data Flow

```
User → Frontend (Next.js) → API Services → PostgreSQL/Redis/Qdrant/Neo4j
                                    ↓
                            Celery Workers (Background Jobs)
```

## 🔧 Configuration

### Environment Variables

See [docs/environment-variables.md](docs/environment-variables.md) for a complete list of environment variables.

### Key Variables

- `DATABASE_URL`: PostgreSQL connection string
- `REDIS_URL`: Redis connection string
- `QDRANT_URL`: Qdrant vector database URL
- `NEO4J_URI`: Neo4j graph database connection
- `OPENAI_API_KEY`: OpenAI API key for AI features
- `CLAUDE_API_KEY`: Anthropic Claude API key (optional)

## 🚢 Deployment

### Coolify Deployment

**Quick Start**: See [docs/deployment/QUICKSTART.md](docs/deployment/QUICKSTART.md) for a step-by-step guide.

**Detailed Guide**: See [docs/deployment/coolify.md](docs/deployment/coolify.md) for comprehensive Coolify deployment instructions.

### Quick Deployment Steps

1. Create PostgreSQL and Redis Database Resources in Coolify
2. Configure environment variables in Coolify
3. Deploy Docker Compose stack
4. Run database migrations
5. Verify services are healthy

## 📚 Documentation

- [Deployment Guide](docs/deployment/coolify.md)
- [Environment Variables](docs/environment-variables.md)
- [AI Assist Documentation](docs/ai-assist.md)

## 🧪 Development

### Running Tests

```bash
# Backend tests
docker-compose exec api pytest

# Frontend tests
cd apps/web && npm test
```

### Database Migrations

```bash
# Create migration
docker-compose exec api alembic revision --autogenerate -m "description"

# Apply migrations
docker-compose exec api alembic upgrade head

# Rollback
docker-compose exec api alembic downgrade -1
```

### Building Images

```bash
# Build all services
docker-compose build

# Build specific service
docker-compose build web
```

## 🔍 Monitoring

### Health Checks

All services expose health check endpoints:
- Frontend: `/api/health`
- API: `/health`
- Chat API: `/health`
- Indexing API: `/health`

### Logs

```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f api
```

## 🛠️ Troubleshooting

### Services not starting

1. Check Docker logs: `docker-compose logs`
2. Verify environment variables are set
3. Ensure database resources are accessible
4. Check port conflicts

### Database connection issues

1. Verify `DATABASE_URL` is correct
2. Check database is running and accessible
3. Ensure network connectivity between services

### AI features not working

1. Verify API keys are set (`OPENAI_API_KEY`, `CLAUDE_API_KEY`)
2. Check API key validity
3. Review service logs for error messages

## 📝 License

Proprietary

## 🤝 Contributing

This is a private project. For questions or issues, contact the development team.
