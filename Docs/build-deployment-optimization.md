# Build & Deployment Optimization

## Overview

This document describes the comprehensive build and deployment optimizations implemented to reduce build times from 20+ minutes to under 5 minutes for typical code changes.

## Problem Statement

Previously, every build took 20+ minutes because:
- Dockerfiles copied the entire repository (`COPY . .`), invalidating cache on any change
- Dependencies were reinstalled on every build
- No layer optimization for dependencies
- No selective builds for changed services

## Solution Architecture

### Multi-Stage Build Strategy

All services now use optimized multi-stage builds with separate dependency layers:

1. **Dependency Layer**: Install dependencies from lock files only
2. **Code Layer**: Copy application code after dependencies are cached
3. **Runtime Layer**: Minimal runtime image with only necessary artifacts

### Services Optimized

- **Web** (`apps/web`): Next.js application
- **Persona API** (`apps/api`): FastAPI backend with PDF processing
- **Chat API** (`apps/chat-api`): Real-time chat service
- **Indexing API** (`apps/indexing-api`): Document indexing service

## Implementation Details

### Web Service (`apps/web/Dockerfile`)

**Before:**
```dockerfile
COPY package*.json ./
COPY apps/web/package*.json apps/web/
COPY packages/types/package*.json packages/types/
RUN npm install
COPY . .  # Invalidates cache on any change
```

**After:**
```dockerfile
# Stage 1: Dependencies
FROM node:22.11.0-alpine AS deps
WORKDIR /app
COPY package*.json ./
COPY apps/web/package*.json apps/web/
COPY packages/types/package*.json packages/types/
COPY tsconfig.base.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci --prefer-offline

# Stage 2: Build
FROM node:22.11.0-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/web/node_modules ./apps/web/node_modules
COPY --from=deps /app/packages/types/node_modules ./packages/types/node_modules
COPY . .
RUN npm run build:web

# Stage 3: Runtime
FROM node:22.11.0-alpine AS runtime
WORKDIR /app
COPY --from=builder /app/apps/web/.next ./apps/web/.next
COPY --from=builder /app/apps/web/public ./apps/web/public
COPY --from=builder /app/apps/web/package.json ./apps/web/
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/web/node_modules ./apps/web/node_modules
```

**Key Improvements:**
- npm cache mounted as build cache (`--mount=type=cache`)
- Only web-specific files copied in final stage
- Dependencies layer cached separately from code

### Python Services

All Python services (api, chat-api, indexing-api) follow the same pattern:

**Before:**
```dockerfile
COPY apps/api ./apps/api
COPY packages/proto ./packages/proto
RUN cd apps/api && uv sync --no-dev
COPY . .  # Invalidates cache
```

**After:**
```dockerfile
# Stage 1: Base with uv
FROM ghcr.io/astral-sh/uv:python3.12-bookworm AS uv-base

# Stage 2: Dependencies
FROM uv-base AS deps
COPY apps/api/pyproject.toml apps/api/uv.lock ./apps/api/
COPY packages/proto/pyproject.toml packages/proto/ ./packages/proto/
RUN --mount=type=cache,target=/root/.cache/uv \
    cd apps/api && uv sync --no-dev --frozen && \
    uv pip install -e /app/packages/proto

# Stage 3: Runtime
FROM python:3.12-slim
# System dependencies in separate layer
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1 libglib2.0-0 poppler-utils tesseract-ocr \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app/apps/api
COPY --from=deps /app/apps/api/.venv ./.venv
COPY apps/api .
COPY packages/proto /app/packages/proto
```

**Key Improvements:**
- uv cache mounted (`--mount=type=cache,target=/root/.cache/uv`)
- Only `pyproject.toml` and `uv.lock` copied for dependency layer
- System dependencies in separate layer (rarely changes)
- Code copied only after dependencies are installed

### Docker Compose Optimization

`infrastructure/compose.yml` now includes:

```yaml
services:
  web:
    build:
      context: ..
      dockerfile: apps/web/Dockerfile
      args:
        - BUILDKIT_INLINE_CACHE=1
      cache_from:
        - ${WEB_IMAGE:-persona-chat/web:dev}
    x-cache-config: &cache-config
      cache_from:
        - type=local,src=${LOCAL_DOCKER_CACHE_ROOT:-/tmp}/web
      cache_to:
        - type=local,dest=${LOCAL_DOCKER_CACHE_ROOT:-/tmp}/web,mode=max
```

**Features:**
- BuildKit inline cache support
- Local cache directory configuration via environment variables
- Parallel builds where possible

### .dockerignore Files

Each service now has a `.dockerignore` to exclude unnecessary files:

**`apps/web/.dockerignore`:**
```
node_modules
.next
.git
*.md
.env*
.DS_Store
coverage
*.log
```

**`apps/api/.dockerignore`:**
```
.venv
__pycache__
*.pyc
.pytest_cache
.git
*.md
.env*
.DS_Store
tests/
alembic/versions/*
```

## Build Scripts

### Helper Script (`scripts/build.sh`)

Provides convenient wrapper for common build operations:

```bash
#!/bin/bash
# Usage: ./scripts/build.sh [service1] [service2] ...
# Example: ./scripts/build.sh web persona-api

set -e

CACHE_ROOT="${LOCAL_DOCKER_CACHE_ROOT:-/tmp/persona-docker-cache}"
mkdir -p "$CACHE_ROOT/web" "$CACHE_ROOT/python"

export DOCKER_BUILDKIT=1
export COMPOSE_DOCKER_CLI_BUILD=1

if [ $# -eq 0 ]; then
  docker compose -f infrastructure/compose.yml build --parallel
else
  docker compose -f infrastructure/compose.yml build "$@"
fi
```

## Environment Variables

All configuration is externalized via environment variables (see `knowledge/build-cache.md`):

- `LOCAL_DOCKER_CACHE_ROOT`: Local BuildKit cache directory
- `WEB_IMAGE`, `PERSONA_API_IMAGE`, etc.: Image tags
- `WEB_RUN_BUILD`: Whether to pre-build Next.js in Docker
- `PYTHON_UV_IMAGE`, `PYTHON_RUNTIME_IMAGE`: Base image versions

## Expected Performance

### Before Optimization
- **Full build**: 20+ minutes
- **Code-only change**: 15+ minutes (dependencies reinstalled)
- **Dependency change**: 20+ minutes

### After Optimization
- **Full build (cold cache)**: ~10 minutes
- **Code-only change**: 2-3 minutes (dependencies cached)
- **Dependency-only change**: <30 seconds (cache hit)
- **No changes**: <30 seconds (full cache hit)

## Best Practices

1. **Always use BuildKit**: Set `DOCKER_BUILDKIT=1` in your environment
2. **Set cache directory**: Configure `LOCAL_DOCKER_CACHE_ROOT` for persistent caching
3. **Selective builds**: Use `scripts/build.sh` to build only changed services
4. **Monitor cache hits**: Check build logs for cache utilization
5. **Update base images**: Regularly check for newer Node.js/Python versions

## Troubleshooting

### Cache Not Working

1. Verify BuildKit is enabled: `DOCKER_BUILDKIT=1 docker buildx version`
2. Check cache directory exists and is writable
3. Ensure `.dockerignore` isn't excluding dependency files

### Build Still Slow

1. Check if dependencies actually changed (compare lock files)
2. Verify cache mounts are working (look for `CACHED` in build output)
3. Consider using remote cache for CI/CD (see `knowledge/build-cache.md`)

### Dependency Installation Fails

1. Ensure lock files are up to date (`npm ci`, `uv sync`)
2. Check base image versions match requirements
3. Verify network access for package registries

## Related Documentation

- `knowledge/build-cache.md`: Detailed cache configuration
- `knowledge/env.md`: Environment variable reference
- `scripts/build.sh`: Build helper script

