FROM ghcr.io/astral-sh/uv:python3.12-bookworm AS builder
WORKDIR /app
COPY apps/api ./apps/api
COPY packages/proto ./packages/proto
RUN cd apps/api && uv sync --no-dev && uv pip install -e /app/packages/proto

FROM python:3.12-slim
WORKDIR /app/apps/api
ENV PYTHONUNBUFFERED=1
COPY --from=builder /app/apps/api/.venv ./.venv
COPY apps/api .
COPY packages/proto /app/packages/proto
ENV PATH="/app/apps/api/.venv/bin:$PATH"
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]

