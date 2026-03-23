# ============================================
# prismatica/apps/frontend — Production build
# ============================================
# Multi-stage: build with Node, serve with nginx.
# Resulting image is ~25 MB.
# ============================================

# ── Stage 1: Build ──────────────────────────
FROM node:22-alpine AS builder

RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

COPY package.json pnpm-lock.yaml* ./
RUN pnpm install --frozen-lockfile 2>/dev/null || pnpm install

COPY tsconfig.json vite.config.ts index.html ./
COPY src/ ./src/

# Build arg for API URL (baked into the bundle)
ARG VITE_API_URL=http://localhost:3001/api
ENV VITE_API_URL=$VITE_API_URL

RUN pnpm run build

# ── Stage 2: Serve with nginx ───────────────
FROM nginx:alpine AS production

# Remove default page
RUN rm -rf /usr/share/nginx/html/*

COPY --from=builder /app/dist /usr/share/nginx/html

# SPA fallback — all routes go to index.html
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
