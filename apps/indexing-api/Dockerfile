# syntax=docker/dockerfile:1.7

ARG UV_IMAGE=ghcr.io/astral-sh/uv:python3.12-bookworm
ARG PYTHON_IMAGE=python:3.12-slim

FROM ${UV_IMAGE} AS uv-base
WORKDIR /app
ENV UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy

FROM uv-base AS deps
COPY packages/proto ./packages/proto
COPY apps/indexing-api/pyproject.toml ./apps/indexing-api/
COPY apps/indexing-api/app ./apps/indexing-api/app
RUN --mount=type=cache,target=/root/.cache/uv \
    cd apps/indexing-api && uv sync --no-dev

FROM deps AS proto
COPY packages/proto ./packages/proto
RUN cd apps/indexing-api && uv pip install -e /app/packages/proto

FROM ${PYTHON_IMAGE} AS runtime
WORKDIR /app/apps/indexing-api
ENV PYTHONUNBUFFERED=1

# Install system dependencies for OpenCV and PDF processing
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1 \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender-dev \
    libgomp1 \
    poppler-utils \
    && rm -rf /var/lib/apt/lists/*

COPY --from=proto /app/apps/indexing-api/.venv ./.venv
COPY apps/indexing-api .
COPY packages/proto /app/packages/proto
ENV PATH="/app/apps/indexing-api/.venv/bin:$PATH"
ENV PYTHONPATH="/app/apps/indexing-api:$PYTHONPATH"
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]

