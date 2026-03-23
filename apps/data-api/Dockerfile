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

LABEL org.opencontainers.image.title="prismatica-api" \
      org.opencontainers.image.description="Prismatica data-api — REST backend" \
      org.opencontainers.image.source="https://github.com/dlesieur/prismatica" \
      org.opencontainers.image.vendor="dlesieur"

ENV PNPM_HOME="/pnpm" \
    PATH="/pnpm:$PATH"

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

# ── Stage 3: Production image ───────────────
# mongosh removed — mongo scripts run inside the mongo container.
# This saves ~160MB (mongosh + build deps).
FROM node:22-alpine AS production

# Only lightweight tools needed at runtime
RUN --mount=type=cache,id=apk,target=/var/cache/apk \
    apk add bash postgresql16-client

ENV PNPM_HOME="/pnpm" \
    PATH="/pnpm:$PATH" \
    NODE_ENV=production \
    DATA_API_PORT=3001 \
    MODEL_SQL_DIR=/app/Model/sql

WORKDIR /app

# Copy compiled output + package manifest (--link for independent layer caching)
COPY --link --chown=1000:1000 --from=builder /app/dist ./dist
COPY --link --chown=1000:1000 --from=builder /app/package.json ./
COPY --link --chown=1000:1000 --from=builder /app/pnpm-lock.yaml* ./

# Prod-only install — cached pnpm store makes this near-instant
RUN --mount=type=cache,id=pnpm-api-prod,target=/pnpm/store \
    corepack enable && corepack prepare pnpm@9.15.0 --activate \
 && (pnpm install --prod --frozen-lockfile 2>/dev/null || pnpm install --prod)

# Runtime SQL schemas + seeds
COPY --link --chown=1000:1000 Model/ ./Model/

# Run as non-root for security
USER node

EXPOSE 3001

HEALTHCHECK --interval=5s --timeout=3s --start-period=30s --retries=10 \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:3001/health || exit 1

CMD ["node", "dist/index.js"]
