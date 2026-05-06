# UX Journey Agent – same repo (monorepo), deploy as separate app in Coolify
# Python 3.11+ required by browser-use
FROM python:3.12-slim-bookworm

WORKDIR /app

# System deps: browser-use/Playwright need Chromium and libs
RUN apt-get update && apt-get install -y --no-install-recommends \
    git \
    ca-certificates \
    libnss3 libatk1.0-0 libatk-bridge2.0-0 libcups2 libdrm2 libxkbcommon0 \
    libxcomposite1 libxdamage1 libxfixes3 libxrandr2 libgbm1 libasound2 \
    fonts-liberation libasound2-plugins \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir --timeout 120 -r requirements.txt

# Install Playwright Chromium (browser-use depends on Playwright)
ENV PLAYWRIGHT_BROWSERS_PATH=/msqdx-playwright
RUN python -m playwright install chromium && python -m playwright install-deps chromium || true

COPY main.py .
COPY entrypoint.sh .
RUN chmod +x entrypoint.sh

ENV PORT=8320
EXPOSE 8320

ENTRYPOINT ["./entrypoint.sh"]
CMD ["python", "main.py"]
