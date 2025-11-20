FROM ghcr.io/astral-sh/uv:python3.12-bookworm AS builder
WORKDIR /app
COPY apps/indexing-api ./apps/indexing-api
COPY packages/proto ./packages/proto
RUN cd apps/indexing-api && uv sync --no-dev && uv pip install -e /app/packages/proto

FROM python:3.12-slim
WORKDIR /app/apps/indexing-api
ENV PYTHONUNBUFFERED=1

# Install system dependencies for OpenCV and PDF processing
RUN apt-get update && apt-get install -y \
    libgl1 \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender-dev \
    libgomp1 \
    && rm -rf /var/lib/apt/lists/*

COPY --from=builder /app/apps/indexing-api/.venv ./.venv
COPY apps/indexing-api .
COPY packages/proto /app/packages/proto
ENV PATH="/app/apps/indexing-api/.venv/bin:$PATH"
ENV PYTHONPATH="/app/apps/indexing-api:$PYTHONPATH"
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]

