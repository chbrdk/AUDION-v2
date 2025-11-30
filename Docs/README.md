# Persona Chat Documentation

This directory contains comprehensive documentation for the Persona Chat project, covering recent implementations, optimizations, and fixes.

## Documentation Index

### Build & Deployment

- **[Build & Deployment Optimization](./build-deployment-optimization.md)**
  - Multi-stage Docker builds
  - Build cache strategies
  - Performance improvements (20+ min → <5 min)
  - Build scripts and tooling

### Frontend

- **[Persona Admin API Fixes](./persona-admin-api-fixes.md)**
  - Module resolution fixes
  - Code refactoring and deduplication
  - Helper utilities
  - Build success validation

### Backend

- **[Backend Ingestion Fixes](./backend-ingestion-fixes.md)**
  - Dynamic data directory configuration
  - Ingestion service hardening
  - Integration tests
  - Error handling improvements

## Quick Reference

### Build Commands

```bash
# Build all services
./scripts/build.sh

# Build specific services
./scripts/build.sh web persona-api

# With custom cache
LOCAL_DOCKER_CACHE_ROOT=/path/to/cache ./scripts/build.sh
```

### Testing

```bash
# Frontend tests
npm run lint --workspace apps/web
npm run typecheck --workspace apps/web
npm run build:web

# Backend tests
cd apps/api && uv run pytest tests/
```

### Environment Variables

See `knowledge/env.md` and `knowledge/build-cache.md` for complete environment variable reference.

## Project Structure

```
AUDION/
├── apps/
│   ├── web/              # Next.js frontend
│   ├── api/              # Persona backend API
│   ├── chat-api/         # Real-time chat service
│   └── indexing-api/     # Document indexing service
├── infrastructure/       # Docker Compose configuration
├── scripts/              # Build and utility scripts
├── knowledge/            # Internal knowledge base
└── Docs/                 # This documentation
```

## Recent Changes

### November 2025

1. **Build Optimization** (2025-11-21)
   - Optimized all Dockerfiles for better caching
   - Reduced build times by 75%+
   - Added build helper scripts

2. **Persona Admin API** (2025-11-21)
   - Fixed Next.js build failures
   - Refactored routes for maintainability
   - Added helper utilities

3. **Backend Ingestion** (2025-11-21)
   - Fixed file path issues
   - Hardened ingestion service
   - Added integration tests

## Contributing

When adding new features or making significant changes:

1. Update relevant documentation in this directory
2. Add tests for new functionality
3. Update `knowledge/` files if configuration changes
4. Document environment variables in `knowledge/env.md`

## Related Resources

- `knowledge/build-cache.md`: Build cache configuration
- `knowledge/env.md`: Environment variables
- `knowledge/ui.md`: UI component documentation
- `knowledge/repos.md`: Repository information

