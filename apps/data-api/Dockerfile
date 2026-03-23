# ============================================
# data-api — Lightweight REST service
# ============================================
# Multi-stage build: install deps, compile TS, run slim.
# Build context should be prismatica/ root (not apps/data-api/)
# so that Model/ schemas can be included.
#
# Build:  docker build -f apps/data-api/Dockerfile .
#         (from prismatica/ root)
# ============================================

# ── Stage 1: Install + Build ────────────────
FROM node:22-alpine AS builder

RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

COPY apps/data-api/package.json apps/data-api/pnpm-lock.yaml* ./
RUN pnpm install --frozen-lockfile 2>/dev/null || pnpm install

COPY apps/data-api/tsconfig.json ./
COPY apps/data-api/src/ ./src/

RUN pnpm run build

# ── Stage 2: Production ─────────────────────
FROM node:22-alpine AS production

RUN corepack enable && corepack prepare pnpm@latest --activate \
 && apk add --no-cache bash postgresql16-client

WORKDIR /app

COPY apps/data-api/package.json apps/data-api/pnpm-lock.yaml* ./
RUN pnpm install --prod --frozen-lockfile 2>/dev/null || pnpm install --prod

COPY --from=builder /app/dist ./dist

# Include Model schemas for runtime SQL/seed operations
COPY Model/ ./Model/

ENV NODE_ENV=production
ENV DATA_API_PORT=3001
ENV MODEL_SQL_DIR=/app/Model/sql

EXPOSE 3001

HEALTHCHECK --interval=10s --timeout=3s --retries=5 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3001/health || exit 1

CMD ["node", "dist/index.js"]
