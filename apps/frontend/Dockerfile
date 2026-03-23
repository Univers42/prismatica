# syntax=docker/dockerfile:1
# ============================================
# prismatica/apps/frontend — Production build
# ============================================
# BuildKit-optimized multi-stage: build with Node, serve with nginx.
#
# Cold build:  ~10-15s (pnpm store cached across builds)
# Warm build:  ~1-2s   (all layers cached)
# Code change: ~3-5s   (deps cached, only Vite rebuilds)
# Image size:  ~25 MB
# ============================================

# ── Stage 1: Install deps ──────────────────
FROM node:22-alpine AS deps

LABEL org.opencontainers.image.title="prismatica-frontend" \
      org.opencontainers.image.description="Prismatica frontend — SPA served by nginx" \
      org.opencontainers.image.source="https://github.com/dlesieur/prismatica" \
      org.opencontainers.image.vendor="dlesieur"

ENV PNPM_HOME="/pnpm" \
    PATH="/pnpm:$PATH"

RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

WORKDIR /app
COPY package.json pnpm-lock.yaml* ./

# Cache mount persists pnpm store — deps install is near-instant on rebuild
RUN --mount=type=cache,id=pnpm-front,target=/pnpm/store \
    pnpm install --frozen-lockfile 2>/dev/null || pnpm install

# ── Stage 2: Vite build ───────────────────
FROM deps AS builder

COPY tsconfig.json vite.config.ts index.html ./
COPY src/ ./src/

ARG VITE_API_URL=/api
ENV VITE_API_URL=$VITE_API_URL

RUN pnpm run build

# ── Stage 3: Serve with nginx (non-root) ──
FROM nginx:alpine AS production

# Remove default site & prepare for non-root
RUN rm -rf /usr/share/nginx/html/* \
 && sed -i '/^user/d' /etc/nginx/nginx.conf \
 && chown -R nginx:nginx /var/cache/nginx /var/log/nginx /etc/nginx/conf.d \
 && touch /var/run/nginx.pid && chown nginx:nginx /var/run/nginx.pid

# SPA config with API proxy — COPY beats inline printf (cacheable, lintable)
COPY --link nginx.conf /etc/nginx/conf.d/default.conf

# Static assets from builder (--link for independent layer caching)
COPY --link --from=builder /app/dist /usr/share/nginx/html

USER nginx

EXPOSE 8080

HEALTHCHECK --interval=5s --timeout=2s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:8080/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
