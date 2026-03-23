# syntax=docker/dockerfile:1
# ============================================
# data-api — Lightweight REST service
# ============================================
# BuildKit-optimized multi-stage build:
#   Cold build:  ~10-15s (cache mounts persist pnpm/npm stores)
#   Warm build:  ~2-3s   (all layers cached)
#   Code change: ~3-5s   (deps cached, only TS recompiles)
#
# Build context: prismatica/ root (not apps/data-api/)
# Build:  docker buildx build -f apps/data-api/Dockerfile .
# ============================================

# ── Stage 1: Install all deps ───────────────
FROM node:22-alpine AS deps

ENV PNPM_HOME="/pnpm" PATH="/pnpm:$PATH"
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

WORKDIR /app
COPY apps/data-api/package.json apps/data-api/pnpm-lock.yaml* ./

# Cache mount keeps pnpm store across builds — no re-download
RUN --mount=type=cache,id=pnpm-api,target=/pnpm/store \
    pnpm install --frozen-lockfile 2>/dev/null || pnpm install

# ── Stage 2: Compile TypeScript ─────────────
FROM deps AS builder

COPY apps/data-api/tsconfig.json ./
COPY apps/data-api/src/ ./src/
RUN pnpm run build

# ── Stage 3: Runtime tools (parallel with 1+2) ──
FROM node:22-alpine AS tools

# Cache apk + npm across builds; install mongosh then remove build deps
RUN --mount=type=cache,id=apk,target=/var/cache/apk \
    --mount=type=cache,id=npm,target=/root/.npm \
    apk add --no-cache bash postgresql16-client python3 make g++ \
 && npm install -g mongosh --ignore-scripts=false 2>/dev/null \
 && apk del python3 make g++

# ── Stage 4: Production image ───────────────
FROM tools AS production

WORKDIR /app

# Copy compiled output + package manifest
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./
COPY --from=builder /app/pnpm-lock.yaml* ./

# Prod-only install — cached pnpm store makes this near-instant
ENV PNPM_HOME="/pnpm" PATH="/pnpm:$PATH"
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
RUN --mount=type=cache,id=pnpm-api-prod,target=/pnpm/store \
    pnpm install --prod --frozen-lockfile 2>/dev/null || pnpm install --prod

# Runtime SQL schemas + seeds
COPY Model/ ./Model/

ENV NODE_ENV=production \
    DATA_API_PORT=3001 \
    MODEL_SQL_DIR=/app/Model/sql

EXPOSE 3001

HEALTHCHECK --interval=5s --timeout=3s --start-period=30s --retries=10 \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:3001/health || exit 1

CMD ["node", "dist/index.js"]
