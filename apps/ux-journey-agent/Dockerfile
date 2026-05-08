# UX Journey Agent — Dockerfile
#
# IMPORTANT: build context must be the **repo root** (not this folder), because
# we install the vendored `checkion-agent` package from `packages/checkion-agent`.
# In Coolify: set "Base Directory" to the repo root and "Dockerfile Location"
# to `apps/ux-journey-agent/Dockerfile`. Locally:
#
#   docker build -f apps/ux-journey-agent/Dockerfile -t ux-journey-agent .
#
# Python 3.12 — required by checkion-agent (>=3.11) and by playwright/asyncio.
FROM python:3.12-slim-bookworm

WORKDIR /app

# System deps: Playwright/Chromium need these libs; ffmpeg transcodes the
# Playwright WebM recording into a smooth, seekable MP4 (constant framerate,
# H.264 yuv420p, +faststart) that browsers can play without judder.
RUN apt-get update && apt-get install -y --no-install-recommends \
    git \
    ca-certificates \
    ffmpeg \
    libnss3 libatk1.0-0 libatk-bridge2.0-0 libcups2 libdrm2 libxkbcommon0 \
    libxcomposite1 libxdamage1 libxfixes3 libxrandr2 libgbm1 libasound2 \
    fonts-liberation libasound2-plugins \
    && rm -rf /var/lib/apt/lists/*

# Step 1: install the vendored checkion-agent fork (soft fork of browser-use 0.12.6).
# Copying the package into a separate prefix keeps the install layer small and
# stable across rebuilds — only changes to packages/checkion-agent invalidate it.
COPY packages/checkion-agent /opt/checkion-agent
RUN pip install --no-cache-dir --timeout 120 "/opt/checkion-agent[video]"

# Step 2: install the app-specific deps (FastAPI, uvicorn, playwright pin).
COPY apps/ux-journey-agent/requirements.txt .
RUN pip install --no-cache-dir --timeout 120 -r requirements.txt

# Step 3: install Playwright Chromium binary into a stable location.
ENV PLAYWRIGHT_BROWSERS_PATH=/msqdx-playwright
RUN python -m playwright install chromium && python -m playwright install-deps chromium || true

# Step 4: copy the app source last so iteration on main.py doesn't re-trigger
# the heavy package installs above.
COPY apps/ux-journey-agent/main.py .
COPY apps/ux-journey-agent/entrypoint.sh .
RUN chmod +x entrypoint.sh

ENV PORT=8320
EXPOSE 8320

ENTRYPOINT ["./entrypoint.sh"]
CMD ["python", "main.py"]
