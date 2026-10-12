# TASK SPEC: Remediate npm audit Advisories Under Strict Quality Gate

## Objective
Remediate security advisories identified in npm/pnpm audit while keeping 100% of the project tests (`pnpm test`) and typechecks (`pnpm check`) green.
Current git branch: `fix/remediate-audit-advisories` (branched from `develop`).

## Constraints & Requirements
1. **Never commit directly to `main`**.
2. **Atomic & Conventional Commits**: Commit each phase separately with meaningful conventional commit messages.
3. **Keep All Tests Green**: All 17 test suites and 80 unit/integration tests must pass without any regression or skipped tests.
4. **Zero Errors in Typecheck**: `pnpm check` must pass with 0 errors and 0 warnings.
5. **pnpm Settings**: In pnpm v11+, the `"pnpm.overrides"` field is deprecated in favor of the root `"overrides"` field in `package.json`. Move `"yaml@<2.8.3": "^2.9.0"` into the top-level `"overrides"` object.

## Phased Execution Plan

### Phase 1: Direct Runtime & Build Advisories
1. In `package.json`:
   - Update `sanitize-html` to `^2.18.0` (resolves moderate advisory GHSA-w5q7-3q8v-xccm).
   - Update `vite` to `^7.3.5` (resolves high advisories GHSA-fx2h-pf6j-xcff and GHSA-v6wh-96g9-6wx3).
   - Move `"yaml@<2.8.3": "^2.9.0"` to top-level `"overrides"` in `package.json`.
2. Run `pnpm install --no-frozen-lockfile --ignore-scripts`.
3. Verify:
   - `pnpm check`
   - `pnpm test`
4. Commit:
   `fix(security): upgrade sanitize-html and vite to patch security advisories`

### Phase 2: Critical Test Suite Advisories (happy-dom & vitest)
1. In `package.json`:
   - Update `happy-dom` to `^20.0.0` (resolves critical VM context escape RCE GHSA-3w8v-5mgv-2cf3).
   - Update `vitest` to `^3.2.6` (resolves critical arbitrary file read GHSA-952p-64cx-59rf and tinypool RCE).
2. Run `pnpm install --no-frozen-lockfile --ignore-scripts`.
3. If `vitest.config.ts` or test imports require adjustments for Vitest 3 / Happy DOM 20:
   - Inspect any test failure.
   - Adjust configuration or test mock setup to ensure all 80 tests pass cleanly.
4. Verify:
   - `pnpm check`
   - `pnpm test`
5. Commit:
   `fix(security): upgrade vitest and happy-dom to resolve critical CVEs`

### Phase 3: Final Verification & Audit Gate
1. Run `pnpm check`.
2. Run `pnpm test:run` / `pnpm test`.
3. Run `pnpm audit`.
4. Output final audit summary and test status.
