# TASK SPEC: CI/CD Test Gate Enforcement & Deployment Protection

## Objective
Update GitHub Actions CI/CD workflows so that:
1. Every Pull Request and push to `main` and `develop` must run and pass the full unit/integration test suite (`pnpm test`), typechecks (`pnpm check`), and linting (`pnpm lint`).
2. The publication workflow (`.github/workflows/publish.yml`) MUST NOT publish Docker images to `ghcr.io` if tests or checks fail (`needs: [test-gate]`).
3. If any test or check fails, the CI/CD pipeline immediately fails (exit code 1) and blocks the deploy.
Current branch: `ci/test-enforcement-gate` (branched from `develop`).

## Constraints & Requirements
1. **Never commit directly to `main`**. All work stays on branch `ci/test-enforcement-gate`.
2. **Atomic Conventional Commits**: Create atomic commits for each phase.
3. **Container Environment Contract**: In all GitHub Actions jobs, set `env: TRACK_BINOCLE_IN_DOCKER: "1"` so `scripts/container-only.mjs` executes cleanly in CI.
4. **All Tests Green**: All 114 tests, typecheck (0 errors, 0 warnings), and quality gates must remain 100% green.
5. **Node & pnpm Alignment**: Node 22 (`node:22-alpine` or `actions/setup-node` with node 22), pnpm 11.5.1 via Corepack.

---

## Phased Execution Plan

### Phase 1: Comprehensive CI Workflow
Update or replace `.github/workflows/typecheck.yml` with `.github/workflows/ci.yml`:
1. Triggers:
   ```yaml
   on:
     pull_request:
     push:
       branches: [main, develop]
   ```
2. Jobs:
   - `quality-gate`:
     - Container or runner with Node 22 and `TRACK_BINOCLE_IN_DOCKER: "1"`.
     - Install dependencies with pnpm 11.5.1 (`pnpm install --frozen-lockfile --ignore-scripts`).
     - Step 1: Typecheck (`node_modules/.bin/astro check`).
     - Step 2: Unit & Integration Tests (`pnpm test`).
     - Step 3: Lint (`pnpm lint`).
3. Commit:
   `ci: add comprehensive test, typecheck, and lint gate workflow`

### Phase 2: Deployment Gate in Publish Workflow
Update `.github/workflows/publish.yml`:
1. Add a preliminary `test-gate` job that executes tests and typechecks before any image build.
   ```yaml
   jobs:
     test-gate:
       name: 🧪 Run Test Gate
       runs-on: ubuntu-latest
       container: node:22-alpine
       env:
         TRACK_BINOCLE_IN_DOCKER: "1"
       steps:
         - uses: actions/checkout@v4
         - name: Install
           run: |
             corepack enable && corepack prepare pnpm@11.5.1 --activate
             pnpm install --frozen-lockfile --ignore-scripts
         - name: Typecheck
           run: node_modules/.bin/astro check
         - name: Test
           run: pnpm test
   ```
2. Add `needs: [test-gate]` to both `build-web` and `build-auth-gateway` jobs.
3. Commit:
   `ci: enforce test gate dependency before publishing docker images`

### Phase 3: Verification
1. Verify YAML syntax of all files in `.github/workflows/`.
2. Run local tests: `pnpm check` and `pnpm test`.
3. Verify git status and commits.
