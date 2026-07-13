# syntax=docker/dockerfile:1.7
# ============================================================================
# prismatica-auth-gateway — the custom API gateway / auth BFF.
#
# Runs scripts/auth-gateway.mjs: the secure server-side broker between the
# website's account model and the app. It holds SERVER-ONLY secrets
# (SERVICE_ROLE_KEY, OSIONOS_BRIDGE_SHARED_SECRET, TURNSTILE_SECRET_KEY, SMTP)
# which are injected at RUNTIME via env — NEVER baked into this image.
#
# It talks to: BaaS/Kong (auth + privileged DB ops via service role), the
# osionos-bridge (mints the osionos session that connects an account to the
# app), Cloudflare Turnstile, and SMTP.
#
# Build context = repository ROOT (needs the vendored @grobase/js SDK):
#   docker build -f apps/opposite-osiris/docker/services/api-gateway/Dockerfile \
#     -t dlesieur/prismatica-auth-gateway .
#
# The gateway's only npm dependency is @grobase/js. Since the baas -> grobase
# extraction, the old `apps/baas/sdk` source tree (this stage used to build it
# from scratch) no longer exists — the SDK is now vendored as a PRE-BUILT
# compiled lib/ at apps/opposite-osiris/vendor/grobase-js (same artifact the web
# image links via `file:./vendor/grobase-js`), so there is nothing to build here.
# ============================================================================

FROM public.ecr.aws/docker/library/node:22-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app

# The gateway code, and the email templates it reads at runtime relative to
# process.cwd() (resolve(process.cwd(), 'src/email-templates')).
COPY apps/opposite-osiris/scripts/auth-gateway.mjs ./scripts/auth-gateway.mjs
COPY apps/opposite-osiris/scripts/auth/ ./scripts/auth/
COPY apps/opposite-osiris/src/email-templates/ ./src/email-templates/

# The only runtime dependency: the pre-built @grobase/js SDK (it has NO
# transitive npm deps), placed where Node resolves a bare `@grobase/js` import.
COPY apps/opposite-osiris/vendor/grobase-js/package.json ./node_modules/@grobase/js/package.json
COPY apps/opposite-osiris/vendor/grobase-js/lib/ ./node_modules/@grobase/js/lib/

# node:22-alpine ships a non-root `node` user (UID 1000) — run as it.
USER node
EXPOSE 8787

# Secrets/config arrive via env at runtime; only the port is assumed here.
HEALTHCHECK --interval=10s --timeout=3s --start-period=15s --retries=6 \
  CMD node -e "fetch('http://127.0.0.1:8787/api/auth/availability').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "scripts/auth-gateway.mjs"]
