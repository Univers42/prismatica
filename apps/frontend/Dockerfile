# ============================================
# prismatica/apps/frontend — Production build
# ============================================
# Multi-stage: build with Node, serve with nginx.
# Optimized for fast rebuilds via pnpm store cache.
#
# Cold build:  ~20-30s (deps cached after first run)
# Code change: ~5-8s   (deps layer cached, only Vite rebuilds)
# Image size:  ~25 MB
# ============================================

# ── Stage 1: Install deps ──────────────────
FROM node:22-alpine AS deps

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

WORKDIR /app

COPY package.json pnpm-lock.yaml* ./
RUN pnpm install --frozen-lockfile 2>/dev/null || pnpm install

# ── Stage 2: Build ─────────────────────────
FROM deps AS builder

COPY tsconfig.json vite.config.ts index.html ./
COPY src/ ./src/

ARG VITE_API_URL=/api
ENV VITE_API_URL=$VITE_API_URL

RUN pnpm run build

# ── Stage 3: Serve with nginx ──────────────
FROM nginx:alpine AS production

RUN rm -rf /usr/share/nginx/html/*

COPY --from=builder /app/dist /usr/share/nginx/html

# SPA fallback + API proxy
RUN printf 'server {\n\
  listen 80;\n\
  root /usr/share/nginx/html;\n\
  index index.html;\n\
  location / {\n\
    try_files $uri $uri/ /index.html;\n\
  }\n\
  location /api {\n\
    proxy_pass http://data-api:3001;\n\
    proxy_set_header Host $host;\n\
    proxy_set_header X-Real-IP $remote_addr;\n\
  }\n\
  location /health {\n\
    proxy_pass http://data-api:3001;\n\
  }\n\
}\n' > /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
