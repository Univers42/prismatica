# TASK SPEC: Fix WCAG 2.5.3 Label in Name on DocsTeaser Copy Button & Verify All 7 Routes

## 1. Exact Filepaths
- `src/components/sections/DocsTeaser.astro`
- `scripts/audit/run-a11y-audit.mjs`

---

## 2. Technical Requirements

### A. Fix `src/components/sections/DocsTeaser.astro`
- On line 49:
  The button currently has:
  ```astro
  <button type="button" class="docs-teaser__copy" data-copy-code aria-label="Copy code sample">
  ```
  The button already contains a visible localized label in `<span class="docs-teaser__copy-label" ...>{t(activeLocale, 'docsTeaser.copy')}</span>` ("Copy" in EN, "Copiar" in ES, "نسخ" in AR).
  Having a hardcoded English `aria-label="Copy code sample"` causes a WCAG 2.5.3 (Label in Name) violation on non-English locales because the accessible name ("Copy code sample") does not contain the visible text ("Copiar" or "نسخ").
  Remove the redundant `aria-label="Copy code sample"` attribute from `<button>` so the accessible name naturally derives from the visible child text.

### B. Verify Audit Across All 7 Routes
- Rebuild static distribution: `pnpm build`.
- Run: `node scripts/audit/run-a11y-audit.mjs`.
- Confirm 0 violations across all 7 routes:
  1. `/`
  2. `/?lang=es`
  3. `/?lang=ar`
  4. `/legal/privacy-policy/`
  5. `/legal/terms/`
  6. `/legal/cookies/`
  7. `/legal/data-rights/`

### C. Commit Plan
- Commit signed by DJSurgeon:
  `git commit -s --author="DJSurgeon <djsurgeon83@gmail.com>" -m "fix(a11y): remove redundant aria-label on copy button to match localized visible text"`

---

## 3. Done-When
- [ ] `node scripts/audit/run-a11y-audit.mjs` exits with code 0 and reports 0 violations across all 7 routes.
- [ ] `pnpm test` (113 suites / 1067 tests pass).
- [ ] `pnpm check` (0 errors, 0 warnings).
- [ ] `pnpm lint` (0 errors).
- [ ] Commit signed by `DJSurgeon <djsurgeon83@gmail.com>`.
