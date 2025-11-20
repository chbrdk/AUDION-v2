# Chat API

Real-time chat and persona service for Dynamic Persona Chat.

## Features

- WebSocket-based real-time chat
- Dynamic persona discovery from research data
- Persona generation and management
- Vector and graph-based retrieval

## Endpoints

- `WS /chat/{conversation_id}` - WebSocket chat endpoint
- `GET /v1/personas/{id}` - Get persona details
- `POST /v1/personas/generate` - Generate new persona
- `GET /health` - Health check
- `GET /health/ready` - Readiness check

## Environment Variables

- `ANTHROPIC_API_KEY` - Anthropic Claude API key
- `DATABASE_URL` - PostgreSQL connection string
- `QDRANT_URL` - Qdrant vector database URL
- `NEO4J_URI` - Neo4j graph database URI
- `INDEXING_API_URL` - URL of the indexing API service

