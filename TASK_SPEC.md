# TASK SPEC: Quality Gates Remediation (Phases 1-3)

## Objective
Fix the failing quality gates identified by `.agents/tools/quality.sh`:
1. ESLint parsing and ignore configuration.
2. Shell formatter (`shfmt`) and linter (`shellcheck`) in `.agents/tools/`.
3. Quality script test gate alignment with containerized environment.

## Phase 1 — ESLint AST & Ignores
1. `eslint.config.mjs`:
   - Add `'vendor/'` and `'.agents/'` to `ignores` array.
2. `src/components/svg/CanvasWindowsIllustration.astro`:
   - Replace literal `widget = () =>` with `widget = () =&gt;` in line 137 to resolve JSX/Astro parse error.
3. Fix unused variable warnings in scripts / tests:
   - `scripts/capture-app.mjs`: prefix unused variable with `_` or remove.
   - `scripts/dev-https.mjs`: remove unused import `isListening`.
   - `src/pages/api/newsletter/subscribe.ts`: remove or prefix unused `error`.
   - `tests/unit/data/backend-architecture.test.ts`: remove unused type imports `ServiceDef`, `Preset`.
   - `tests/unit/lib/dom-utils.test.ts`: prefix or remove unused mock callback variables.

## Phase 2 — Quality Script Container Alignment
1. `.agents/tools/quality.sh`:
   - Update `g_npm_test` to run inside the dev container if container is running or use `pnpm test` rather than host `npm test`.
   - Update `g_eslint` to invoke containerized linter or check `.astro` files with proper parser options.

## Phase 3 — Shell Script Formatting & Linting
1. Format `.agents/tools/*.sh` and `.agents/tools/lib/*.sh` using `shfmt -w`.
2. Fix any `shellcheck` warnings (quote expansions, command checks).

## Acceptance Criteria
- `pnpm lint` in container (`docker exec opposite-osiris pnpm lint`) exits 0 with 0 errors.
- `docker exec opposite-osiris pnpm test` exits 0 with all 17 test suites (80 tests) green.
- `.agents/tools/quality.sh --no-audit --with-tests` exits 0 with PASS across lint, format, types, and tests.
- Conventional atomic commits on branch `fix/quality-gates`.
