# syntax=docker/dockerfile:1.7

ARG UV_IMAGE=ghcr.io/astral-sh/uv:python3.12-bookworm
ARG PYTHON_IMAGE=python:3.12-slim

FROM ${UV_IMAGE} AS uv-base
WORKDIR /app
ENV UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy

FROM uv-base AS deps
COPY packages/proto ./packages/proto
COPY apps/chat-api/pyproject.toml ./apps/chat-api/
COPY apps/chat-api/app ./apps/chat-api/app
RUN --mount=type=cache,target=/root/.cache/uv \
    cd apps/chat-api && uv sync --no-dev

FROM deps AS proto
RUN cd apps/chat-api && uv pip install -e /app/packages/proto

FROM ${PYTHON_IMAGE} AS runtime
WORKDIR /app/apps/chat-api
ENV PYTHONUNBUFFERED=1
COPY --from=proto /app/apps/chat-api/.venv ./.venv
COPY apps/chat-api .
COPY packages/proto /app/packages/proto
RUN rm -f .venv/bin/python .venv/bin/python3 .venv/bin/python3.12 .venv/bin/python3.14 && \
    ln -s /usr/local/bin/python3 .venv/bin/python && \
    ln -s /usr/local/bin/python3 .venv/bin/python3 && \
    ln -s /usr/local/bin/python3 .venv/bin/python3.12
ENV PATH="/app/apps/chat-api/.venv/bin:$PATH"
ENV PYTHONPATH="/app/apps/chat-api:$PYTHONPATH"
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8001"]

