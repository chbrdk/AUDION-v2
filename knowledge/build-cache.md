# Build Cache Reference

## Required Environment Variables

Set these keys in the shared `.env` (see `knowledge/env.md`) so Docker builds never embed hard-coded paths or registry URLs:

| Variable | Purpose |
| --- | --- |
| `LOCAL_DOCKER_CACHE_ROOT` | Absolute path for local BuildKit cache mirrors. Example: `/Users/<you>/.cache/persona-docker`. |
| `WEB_IMAGE` | Tag used by `apps/web` and nginx (`persona-chat/web:dev`, `registry.example.com/persona/web:main`, …). |
| `WEB_NODE_IMAGE` | Base Node.js image (default `node:22.11.0-alpine`). Update when a newer LTS ships. |
| `WEB_RUN_BUILD` | `true` to pre-build Next.js in Docker (production), `false` for dev. |
| `PERSONA_API_IMAGE` | Shared image for `persona-api` + worker. |
| `INDEXING_API_IMAGE` | Shared image for `indexing-api` + worker. |
| `CHAT_API_IMAGE` | Image for the realtime chat service. |
| `PYTHON_UV_IMAGE` | Builder image for uv-based services (default `ghcr.io/astral-sh/uv:python3.12-bookworm`). |
| `PYTHON_RUNTIME_IMAGE` | Runtime base for FastAPI services (default `python:3.12-slim`). |

> Keep registry URLs, cache directories, and base image choices updated here so we never hard-code them inside Dockerfiles or Compose.

## Local Build Cache Layout

With `LOCAL_DOCKER_CACHE_ROOT` set, BuildKit stores cached layers under:

- `${LOCAL_DOCKER_CACHE_ROOT}/web` – Next.js layers (`apps/web`)
- `${LOCAL_DOCKER_CACHE_ROOT}/python` – Shared cache for all uv-based services

Make sure the parent directory exists before running `docker compose build`:

```sh
mkdir -p "$LOCAL_DOCKER_CACHE_ROOT/web" "$LOCAL_DOCKER_CACHE_ROOT/python"
```

## Standard Build Commands

| Target | Command |
| --- | --- |
| Web (dev) | `DOCKER_BUILDKIT=1 docker compose -f infrastructure/compose.yml build web` |
| Web (prod) | `WEB_RUN_BUILD=true DOCKER_BUILDKIT=1 docker compose -f infrastructure/compose.yml build web` |
| Persona API | `DOCKER_BUILDKIT=1 docker compose -f infrastructure/compose.yml build persona-api` |
| Indexing API | `DOCKER_BUILDKIT=1 docker compose -f infrastructure/compose.yml build indexing-api` |
| Chat API | `DOCKER_BUILDKIT=1 docker compose -f infrastructure/compose.yml build chat-api` |

Set `DOCKER_BUILDKIT=1` globally in your shell/CI runners for deterministic caching.

## Helper Script

`scripts/build.sh` wraps the common build targets and enforces the `LOCAL_DOCKER_CACHE_ROOT` requirement:

```sh
# Build everything
LOCAL_DOCKER_CACHE_ROOT=/Users/<you>/.cache/persona-docker ./scripts/build.sh

# Build a subset
LOCAL_DOCKER_CACHE_ROOT=/Users/<you>/.cache/persona-docker ./scripts/build.sh web persona-api
```

The script automatically creates the cache directories before invoking `docker compose`.

## Remote Cache / Registry Handoff

If you publish cache layers or images to a registry, store the actual URLs here and expose them via environment variables (for example `DOCKER_CACHE_REF`, `WEB_IMAGE`, …). CI should:

1. Run `docker buildx build` with `--cache-from type=registry,ref=$DOCKER_CACHE_REF`.
2. Push the updated cache with `--cache-to type=registry,ref=$DOCKER_CACHE_REF,mode=max`.

This keeps registry endpoints centralized without ever committing them into Compose/Dockerfiles.

## Version Policy

- Run a quick release check (Node.js, Python) each time before bumping `WEB_NODE_IMAGE`, `PYTHON_UV_IMAGE`, or `PYTHON_RUNTIME_IMAGE`.
- Record the chosen versions here and in commit messages to document why we upgraded.

