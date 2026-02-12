# syntax=docker/dockerfile:1.7

ARG NODE_IMAGE=node:22.11.0-alpine

FROM ${NODE_IMAGE} AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1 \
    NEXT_CACHE_DIR=/app/apps/web/.next/cache
RUN corepack enable && npm config set fund false && npm config set audit false

FROM base AS deps
# Install git for cloning design system  
RUN apk add --no-cache git

# Clone and build msqdx-design-system FIRST (before npm install)
# Path file:../../../msqdx-design-system resolves from /app/apps/web to /msqdx-design-system
RUN git clone --depth 1 https://github.com/chbrdk/msqdx-design-system.git /msqdx-design-system && \
    cd /msqdx-design-system && npm install && npm run build

# Copy workspace configuration
COPY package.json package-lock.json ./
COPY tsconfig.base.json ./

# Copy complete workspace structure (needed for npm workspaces)
COPY apps/web/package.json apps/web/
COPY packages/types/package.json packages/types/
COPY packages/types/src packages/types/src
COPY packages/types/tsconfig.json packages/types/

# Install dependencies - design system is now available at /msqdx-design-system
# file:../../../msqdx-design-system from /app/apps/web resolves to /msqdx-design-system
RUN --mount=type=cache,target=/root/.npm \
    npm cache clean --force || true && \
    (npm install --include-workspace-root --legacy-peer-deps --no-audit --no-fund || \
    (npm cache clean --force && npm install --include-workspace-root --legacy-peer-deps --no-audit --no-fund) || \
    (npm cache clean --force && npm install --legacy-peer-deps --no-audit --no-fund) || \
    (echo "npm install failed completely" && exit 1)) && \
    ls -la node_modules || (echo "node_modules not created" && exit 1)

FROM deps AS builder
ARG RUN_WEB_BUILD=false
ARG NODE_ENV=production
ENV NODE_ENV=${NODE_ENV}
COPY packages/types packages/types
COPY apps/web apps/web
RUN npm run build --workspace packages/types
RUN mkdir -p apps/web/.next
RUN --mount=type=cache,target=/tmp/.next-cache \
    sh -c 'if [ "${RUN_WEB_BUILD}" = "true" ]; then CI=true FORCE_COLOR=0 npm run build:web; else echo "Skipping Next.js build"; fi'

FROM base AS runner
# Copy design system for runtime (if needed by Next.js)
COPY --from=deps /msqdx-design-system /msqdx-design-system
COPY --from=deps /app/node_modules ./node_modules
COPY package.json package-lock.json ./
COPY tsconfig.base.json ./
COPY packages/types packages/types
COPY --from=builder /app/packages/types/dist ./packages/types/dist
COPY apps/web apps/web
COPY --from=builder /app/apps/web/.next ./apps/web/.next
EXPOSE 3000
CMD ["npm", "run", "dev:web"]

