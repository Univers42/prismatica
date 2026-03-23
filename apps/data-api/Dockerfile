# ============================================
# data-api — Lightweight REST service
# ============================================
# Multi-stage build optimized for speed:
#   Cold build:  ~15-25s (deps cached after first run)
#   Code change: ~3-5s   (deps layer cached, only TS recompiles)
#
# Build context: prismatica/ root (not apps/data-api/)
# Build:  docker build -f apps/data-api/Dockerfile .
# ============================================

# ── Stage 1: Dependency base ────────────────
FROM node:22-alpine AS deps

# Pin pnpm version — avoids slow `corepack prepare pnpm@latest` download
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

WORKDIR /app

# Copy ONLY package files → Docker caches this layer until deps change
COPY apps/data-api/package.json apps/data-api/pnpm-lock.yaml* ./

# Single install — all deps (dev + prod). Frozen lockfile for speed.
RUN pnpm install --frozen-lockfile 2>/dev/null || pnpm install

# ── Stage 2: Build TypeScript ───────────────
FROM deps AS builder

COPY apps/data-api/tsconfig.json ./
COPY apps/data-api/src/ ./src/

RUN pnpm run build

# ── Stage 3: Production (minimal) ───────────
FROM node:22-alpine AS production

# bash + psql for SQL scripts, mongosh for MongoDB setup scripts
RUN apk add --no-cache bash postgresql16-client python3 make g++ \
 && npm install -g mongosh --ignore-scripts=false 2>/dev/null \
 && apk del python3 make g++ \
 && rm -rf /root/.npm /tmp/*

WORKDIR /app

# Copy compiled JS + package files for prod install
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./
COPY --from=builder /app/pnpm-lock.yaml* ./

# Prod-only install is fast (~2s) — few direct deps
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
RUN pnpm install --prod --frozen-lockfile 2>/dev/null || pnpm install --prod

# Include Model schemas for runtime SQL/seed operations
COPY Model/ ./Model/

ENV NODE_ENV=production
ENV DATA_API_PORT=3001
ENV MODEL_SQL_DIR=/app/Model/sql

EXPOSE 3001

HEALTHCHECK --interval=10s --timeout=3s --retries=5 \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:3001/health || exit 1

CMD ["node", "dist/index.js"]
