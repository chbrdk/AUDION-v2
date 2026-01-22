# syntax=docker/dockerfile:1.7

ARG NODE_IMAGE=node:22.11.0-alpine

FROM ${NODE_IMAGE} AS base
WORKDIR /app
ENV NODE_ENV=development \
    NEXT_TELEMETRY_DISABLED=1 \
    NEXT_CACHE_DIR=/app/apps/web/.next/cache
RUN corepack enable && npm config set fund false && npm config set audit false

FROM base AS deps
# Copy workspace configuration first
COPY package.json package-lock.json ./
COPY tsconfig.base.json ./
# Copy workspace package.json files
COPY apps/web/package.json apps/web/
COPY packages/types/package.json packages/types/
# Install dependencies with workspace support (npm workspaces handles linking automatically)
RUN --mount=type=cache,target=/root/.npm \
    npm install --workspaces --legacy-peer-deps || \
    npm install --include-workspace-root --legacy-peer-deps

FROM deps AS builder
ARG RUN_WEB_BUILD=false
COPY packages/types packages/types
COPY apps/web apps/web
RUN npm run build --workspace packages/types
RUN mkdir -p apps/web/.next
RUN --mount=type=cache,target=/tmp/.next-cache \
    sh -c 'if [ "${RUN_WEB_BUILD}" = "true" ]; then npm run build:web; else echo "Skipping Next.js build"; fi'

FROM base AS runner
COPY --from=deps /app/node_modules ./node_modules
COPY package.json package-lock.json ./
COPY tsconfig.base.json ./
COPY packages/types packages/types
COPY --from=builder /app/packages/types/dist ./packages/types/dist
COPY apps/web apps/web
COPY --from=builder /app/apps/web/.next ./apps/web/.next
EXPOSE 3000
CMD ["npm", "run", "dev:web"]

