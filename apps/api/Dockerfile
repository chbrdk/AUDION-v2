# syntax=docker/dockerfile:1.7

ARG UV_IMAGE=ghcr.io/astral-sh/uv:python3.12-bookworm
ARG PYTHON_IMAGE=python:3.12-slim

FROM ${UV_IMAGE} AS uv-base
WORKDIR /app
ENV UV_COMPILE_BYTECODE=0 \
    UV_LINK_MODE=copy

FROM uv-base AS deps
COPY apps/api/pyproject.toml apps/api/uv.lock ./apps/api/
COPY apps/api/README.md ./apps/api/
COPY apps/api/app ./apps/api/app
COPY apps/api/worker ./apps/api/worker
RUN --mount=type=cache,target=/root/.cache/uv \
    cd apps/api && uv sync --no-dev --frozen
RUN --mount=type=cache,target=/root/.cache/uv \
    cd apps/api && uv pip install 'unstructured[pdf]' --reinstall-package unstructured

FROM deps AS proto
COPY packages/proto ./packages/proto
RUN cd apps/api && uv pip install -e /app/packages/proto

FROM ${PYTHON_IMAGE} AS runtime
# Install system libraries required for OpenCV/PDF processing
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1 \
    libglib2.0-0 \
    libgomp1 \
    poppler-utils \
    tesseract-ocr \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app/apps/api
ENV PYTHONUNBUFFERED=1
COPY --from=proto /app/apps/api/.venv ./.venv
COPY apps/api .
COPY packages/proto /app/packages/proto
COPY apps/api/start.sh /app/apps/api/start.sh
RUN chmod +x /app/apps/api/start.sh
ENV PATH="/app/apps/api/.venv/bin:$PATH"
CMD ["/app/apps/api/start.sh"]

