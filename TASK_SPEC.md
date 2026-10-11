# Specification: Decompose BackendArchitecture.astro (Option A - Low Risk)

## Objective
Refactor `src/components/sections/BackendArchitecture.astro` (527 lines) down below the 300-line engineering limit by extracting declarative static dataset configurations and topology graphics into modular components.

## Target Structure
1. `src/data/backend-architecture.ts`:
   - Interfaces: `ServiceCategory`, `ServiceDef`, `Preset`, `NodePosition`.
   - Datasets: `SERVICES`, `PRESETS`, `EDGES`, `NODE_POSITIONS`, helper `getNodeCenter(id)`.
   - Unit tests verifying data integrity in `tests/unit/data/backend-architecture.test.ts`.

2. `src/components/sections/backend-architecture/BackendTopologySvg.astro`:
   - Modular SVG rendering for the interactive graph (markers, lines, node groups).
   - Props: `services: ServiceDef[]`, `edges: Array<[string, string]>`, `positions: Record<string, NodePosition>`.

3. `src/components/sections/BackendArchitecture.astro`:
   - Lean orchestrator importing data from `@/data/backend-architecture` and topology component.
   - Preserves all data attributes (`data-arch-canvas`, `data-preset`, `data-node`, `data-edge`, `data-metric`, `data-arch-tradeoff`) and interactive client script untouched.
   - Resulting file size: < 220 lines.

## Acceptance Criteria
- Vitest unit tests for `src/data/backend-architecture.ts` pass 100%.
- `docker exec opposite-osiris pnpm check` passes with 0 errors.
- `docker exec opposite-osiris pnpm test` passes with all suites green.
- `http://localhost:4322/` interactive node toggles and metrics update work without regression.
- Conventional atomic commits on branch `refactor/decompose-backend-architecture`.
