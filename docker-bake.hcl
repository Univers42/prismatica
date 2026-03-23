// ============================================
// Prismatica — Docker Bake build definition
// ============================================
// Builds both images IN PARALLEL with shared cache.
//
// Usage:
//   docker buildx bake              # build all
//   docker buildx bake api          # build API only
//   docker buildx bake frontend     # build frontend only
//   docker buildx bake --push       # build + push to Docker Hub
// ============================================

variable "DOCKER_USER" {
  default = "dlesieur"
}

variable "TAG" {
  default = "latest"
}

variable "VITE_API_URL" {
  default = "/api"
}

// ── Shared defaults ─────────────────────────
group "default" {
  targets = ["api", "frontend"]
}

target "api" {
  context    = "."
  dockerfile = "apps/data-api/Dockerfile"
  tags       = ["${DOCKER_USER}/prismatica-api:${TAG}"]
  // Pull inline cache from the production image itself (not a separate :cache tag)
  cache-from = ["type=registry,ref=${DOCKER_USER}/prismatica-api:${TAG}"]
  cache-to   = ["type=inline"]
  output     = ["type=docker"]
}

target "frontend" {
  context    = "apps/frontend"
  dockerfile = "Dockerfile"
  tags       = ["${DOCKER_USER}/prismatica-frontend:${TAG}"]
  args = {
    VITE_API_URL = "${VITE_API_URL}"
  }
  // Pull inline cache from the production image itself (not a separate :cache tag)
  cache-from = ["type=registry,ref=${DOCKER_USER}/prismatica-frontend:${TAG}"]
  cache-to   = ["type=inline"]
  output     = ["type=docker"]
}
