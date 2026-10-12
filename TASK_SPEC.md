# TASK SPEC: Prismatica Client Runtime Decomposition & Dead Scaffolding Removal

## Context & Objectives
Prismatica is an Astro-based platform with client-side interactive widgets.
The client scripts currently have two critical architectural flaws:
1. `src/features/` contains empty, speculative placeholder directories (`baas-status`, `consent`, `mascot`, `portal`, `theme`) that are completely unused (0 imports across the codebase). They constitute over-engineering and must be removed.
2. `src/scripts/main.ts` is a 2,172 LOC monolith containing mascot physics, auth modal form validation, theme toggling, GDPR consent banner, and duplicate runtime HTML template strings (`createPortalMarkup`).
3. `<dialog id="portal">` is already authored in `src/components/ui/Portal.astro`, but `main.ts` still generates duplicate HTML strings via `createPortalMarkup(mode)` and injects them via `insertTrustedHTML`.

Current branch: `refactor/scripts-cleanup` (branched from `develop`).

---

## Non-Negotiable Constraints
1. **Branch Discipline**: Work ONLY on branch `refactor/scripts-cleanup`. NEVER switch branches or commit to `main`/`develop`.
2. **Git Commits**: Author every commit as:
   - Name: `DJSurgeon`
   - Email: `djsurgeon83@gmail.com`
   Run:
   ```bash
   git config user.name "DJSurgeon"
   git config user.email "djsurgeon83@gmail.com"
   ```
   Use atomic Conventional Commits (`refactor(...)`, `test(...)`, `chore(...)`).
3. **No Breaking Changes**: All public user-facing behavior, keyboard navigation, a11y attributes, ARIA live regions, and event listeners MUST continue working identically.
4. **Zero Errors & Zero Warnings**:
   - `node_modules/.bin/astro check` MUST exit 0 with 0 errors and 0 warnings.
   - `pnpm test` MUST pass 100% of tests (current: 114 tests passing).
5. **No File Exceeds 300 LOC**: Split modules so that logic is cohesive and files stay maintainable (or as lean as practically possible without artificial splits).

---

## Phased Execution Plan

### Phase 1: Prune Unused Scaffolding
1. Remove the dead `src/features/` directory (`rm -rf src/features`).
2. Verify with `git status` that only empty/unused dummy files are removed.
3. Commit:
   `chore(cleanup): remove unused speculative features scaffolding`

### Phase 2: Extract Theme & Motion Preference Module (`src/scripts/theme.ts`)
1. Create `src/scripts/theme.ts`:
   - Exports: `initialTheme`, `updateThemeButton`, `applyTheme`, `cycleTheme`, `updateMotionButton`, `applyMotionPreference`, `bindThemeControls`.
   - Use existing `src/lib/theme-config.ts` and `src/lib/dom-utils.ts`.
2. Ensure types (`ThemeName`, etc.) are cleanly imported.
3. Add unit tests for `src/scripts/theme.ts` in `tests/unit/scripts/theme.test.ts` (testing initial preference detection, cycleTheme, storage sync).
4. Update `src/scripts/main.ts` to import and call `bindThemeControls` / theme functions.
5. Verify `astro check` and `pnpm test`.
6. Commit:
   `refactor(scripts): extract theme and motion preferences to theme.ts`

### Phase 3: Extract GDPR & Consent Module (`src/scripts/consent.ts`)
1. Create `src/scripts/consent.ts`:
   - Exports: `ConsentPreferences`, `readConsentPreferences`, `storeConsentPreferences`, `bindConsentBanner`.
   - Uses `src/data/legal.ts`, `src/lib/storage.ts`, `src/lib/dom-utils.ts`.
2. Add unit tests in `tests/unit/scripts/consent.test.ts`.
3. Update `src/scripts/main.ts` to import and call `bindConsentBanner`.
4. Verify `astro check` and `pnpm test`.
5. Commit:
   `refactor(scripts): extract gdpr consent management to consent.ts`

### Phase 4: Extract Mascot Subsystem (`src/scripts/mascot.ts`)
1. Create `src/scripts/mascot.ts`:
   - All mascot-related types: `MascotMood`, `MascotState`.
   - SVG markup generator: `mascotSvgMarkup`, `characterMarkup`.
   - Physics, gaze tracking, mood transitions, particle effects: `prepareMascotSvg`, `mascotMotionPaused`, `stopMascotEffects`, `createHeart`, `createSleepZ`, `createLaughParticle`, `createPing`, `startMascotStars`, `liftMascotBrows`, `startMascotMoodEffect`, `wakeMascotPose`, `sleepMascotPose`, `setMascotMood`, `updateMascotOrbit`, `updateMascotPoseFromPointer`, `updateMascotTarget`, `animateMascot`, `startMascotBlink`, `bindMascotInteractions`, `mountMascot`, `setMountedMascotMood`, `notifyWithMascot`.
   - Export `mountMascot`, `setMountedMascotMood`, `notifyWithMascot`.
   - Note on coupling: `mountMascot(onOpenPortal?: (mode: 'start' | 'connect') => void)` takes a callback when clicked, preventing circular dependency on `portal.ts`.
2. Update `src/scripts/main.ts` to use `src/scripts/mascot.ts`.
3. Verify `astro check` and `pnpm test`.
4. Commit:
   `refactor(scripts): extract mascot svg and mood physics to mascot.ts`

### Phase 5: Deconstruct Portal & Form Auth (`src/scripts/portal.ts`)
1. Create `src/scripts/portal.ts`:
   - Portal dialog open/close lifecycle (`openPortal`, `closePortal`).
   - Use the pre-rendered `<dialog id="portal">` if present in DOM, or gracefully support dynamic portal. Eliminate duplicate `createPortalMarkup()` string template in favor of clean DOM querying and configuration of `#portal`.
   - Form fields, validation, and auth submission orchestration (`validatePortalAuth`, `syncPortalPasswordFeedback`, `validateRegistrationAvailability`, `bindEmailFieldValidation`, `bindPasswordToggles`).
   - Lazy Turnstile script loading on portal open.
   - Exports: `openPortal`, `closePortal`, `initPortal`.
2. Update `src/scripts/main.ts` to import and initialize portal controls.
3. Verify `astro check` and `pnpm test`.
4. Commit:
   `refactor(scripts): extract portal and auth validation to portal.ts`

### Phase 6: Streamline Entry Orchestrator (`src/scripts/main.ts`)
1. Refactor `src/scripts/main.ts`:
   - It becomes a lean entry point (~50-80 LOC) that imports modules and binds DOM lifecycle (`DOMContentLoaded`, `whenIdle`).
2. Run full quality gate:
   - `node_modules/.bin/astro check` -> 0 errors, 0 warnings.
   - `pnpm test` -> all tests passing.
   - `pnpm lint` -> 0 errors.
3. Commit:
   `refactor(scripts): streamline main.ts as lean entry point orchestrator`
