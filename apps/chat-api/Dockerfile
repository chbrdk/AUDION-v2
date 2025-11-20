FROM ghcr.io/astral-sh/uv:python3.12-bookworm AS builder
WORKDIR /app
COPY apps/chat-api ./apps/chat-api
COPY packages/proto ./packages/proto
RUN cd apps/chat-api && uv sync --no-dev && uv pip install -e /app/packages/proto

FROM python:3.12-slim
WORKDIR /app/apps/chat-api
ENV PYTHONUNBUFFERED=1
COPY --from=builder /app/apps/chat-api/.venv ./.venv
COPY apps/chat-api .
COPY packages/proto /app/packages/proto
RUN rm -f .venv/bin/python .venv/bin/python3 .venv/bin/python3.12 .venv/bin/python3.14 && \
    ln -s /usr/local/bin/python3 .venv/bin/python && \
    ln -s /usr/local/bin/python3 .venv/bin/python3 && \
    ln -s /usr/local/bin/python3 .venv/bin/python3.12
ENV PATH="/app/apps/chat-api/.venv/bin:$PATH"
ENV PYTHONPATH="/app/apps/chat-api:$PYTHONPATH"
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8001"]

