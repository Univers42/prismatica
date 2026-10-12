# TASK SPEC: Comprehensive WCAG 2.2 Accessibility & Contrast Test Coverage

## Objective
Implement new unit test suites in Vitest under `tests/unit/` verifying WCAG 2.2 AA accessibility, color token contrast ratios, and accessible form live feedback without altering production runtime behavior.
Current branch: `test/wcag-responsive-coverage` (branched from `develop`).

## Constraints & Rules
1. **Never commit directly to `main`**. All work stays on branch `test/wcag-responsive-coverage`.
2. **Atomic Conventional Commits**: Create separate atomic commits for each phase.
3. **Keep All Tests 100% Green**: All 80 existing tests + all new tests must pass stably.
4. **Zero Errors / Zero Warnings**: `pnpm check` and linter/formatter must pass with 0 errors and 0 warnings.
5. **Happy DOM Compatibility**: Do not rely on layout engine bounding box metrics (`getBoundingClientRect()`). Use DOM attributes, event listeners, keyboard traps, and mathematical formulas for contrast calculations.

---

## Phased Execution Plan

### Phase 1: WCAG 2.2 Modal, Keyboard & Motion Accessibility
Create `tests/unit/lib/a11y-wcag.test.ts`:
1. Modal / Dialog Focus Management:
   - Verify modal open sets `aria-modal="true"` and traps keyboard focus inside container.
   - Verify `Escape` key event triggers close callback and returns focus to opener element.
   - Verify non-interactive container gracefully handles focus fallback.
2. Reduced Motion & Skip Links:
   - Verify `.motion-paused` toggle on `<html>` pauses animations and disables CSS transitions.
   - Verify `aria-expanded` toggles for expandable sections (e.g. mobile navigation / accordions).
3. Run verification:
   - `pnpm test`
4. Commit:
   `test(a11y): add wcag 2.2 modal focus trap and motion preference unit tests`

### Phase 2: Color Token Mathematical Contrast Ratio Suite
Create `tests/unit/lib/contrast-tokens.test.ts`:
1. WCAG 2.2 Relative Luminance & Contrast Formula Helper:
   - Implement standard sRGB relative luminance: $L = 0.2126 \cdot R + 0.7152 \cdot G + 0.0722 \cdot B$ where values are linearized.
   - Contrast ratio formula: $(L_1 + 0.05) / (L_2 + 0.05)$.
2. Contrast Assertions:
   - Normal text against surface must be $\ge 4.5:1$ (WCAG SC 1.4.3).
   - Large text / headings ($\ge 18\text{pt}$ or $14\text{pt}$ bold) must be $\ge 3:1$.
   - UI boundaries and focus outlines must be $\ge 3:1$ (WCAG SC 1.4.11).
   - Parameterized tests for themes (`swiss`, `aurora`, `solar`, `ember`, `forest`).
3. Run verification:
   - `pnpm test`
4. Commit:
   `test(contrast): add wcag 2.2 token relative luminance and contrast ratio suite`

### Phase 3: Form Feedback & ARIA Live Regions
Create `tests/unit/features/newsletter-feedback.test.ts`:
1. Form State & Live Announcements:
   - Test that submitting form with valid email updates `aria-live="polite"` feedback container.
   - Test that empty or invalid email associates error text with input via `aria-describedby` and sets `aria-invalid="true"`.
   - Test error feedback renders container with `role="alert"`.
2. Final Verification:
   - `pnpm check`
   - `pnpm test`
3. Commit:
   `test(forms): add accessible form feedback and live region unit tests`
