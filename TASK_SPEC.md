# TASK SPEC: Extract CanvasWindowsIllustration.astro (Lowest-Risk Refactor)

## Objective
Decompose `src/components/sections/CanvasWindowsSection.astro` (273 lines) by extracting its embedded SVG graphic (lines 17–146) into a dedicated SVG component `src/components/svg/CanvasWindowsIllustration.astro`, aligning with the existing SVG architecture (`WorkspaceIllustration.astro`, `CharacterIllustration.astro`, `HeroPortalPreview.astro`).

## Architecture & Requirements
1. Create `src/components/svg/CanvasWindowsIllustration.astro`:
   - Must contain the entire `<svg class="canvas-windows__svg" viewBox="0 0 1100 640" ...>...</svg>` markup with its `<title>`, `<desc>`, `<defs>` (filters `canvas-wobble`, `canvas-wobble-tight`, pattern `canvas-dots`), and drawing paths.
   - Preserves all accessibility attributes, roles, and IDs.
   - Accepts optional class prop if needed.

2. Refactor `src/components/sections/CanvasWindowsSection.astro`:
   - Import `CanvasWindowsIllustration` from `../svg/CanvasWindowsIllustration.astro`.
   - Replace the embedded `<svg>` element inside `<figure class="canvas-windows__figure" data-scroll-grow>` with `<CanvasWindowsIllustration />`.
   - Preserve all surrounding copy, styling, and data attributes (`data-scroll-rise`, `data-scroll-grow`).
   - Must drop the file size below 160 lines.

3. Testing & Verification Gate:
   - Create unit/render test in `tests/unit/components/CanvasWindowsIllustration.test.ts` verifying the SVG contains expected titles, descriptions, and filters.
   - Run `pnpm check` and `pnpm test` inside container.
   - All tests must pass with 0 errors.

## Git Workflow
- All work on branch `refactor/extract-canvas-windows-illustration`.
- Atomic conventional commits:
  - `feat(svg): extract CanvasWindowsIllustration component and add tests`
  - `refactor(canvas-windows): delegate SVG rendering to CanvasWindowsIllustration`
