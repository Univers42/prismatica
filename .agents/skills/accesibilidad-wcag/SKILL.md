---
name: accesibilidad-wcag
description: >-
  Front-end accessibility auditor and implementer for WCAG 2.2 Level AA and WCAG 3.0 draft guidelines in Prismatica. Triggers on: "accessibility", "wcag", "a11y", "contrast", "focus trap", "target size", or "/a11y".
---

# Universal Accessibility (WCAG 2.2 AA / WCAG 3.0)

## Purpose
Ensure all HTML, SCSS, TypeScript, and Astro components across Prismatica strictly adhere to **WCAG 2.2 Level AA** standards and emerging WCAG 3.0 draft guidelines, respecting the project's design system tokens, strict Content Security Policy (CSP), and bidirectional (LTR/RTL) layout mirroring while maintaining token economy.

---

## 1. Non-Negotiable WCAG 2.2 AA Criteria

1. **Target Size (Minimum) [SC 2.5.8 - Level AA]:**
   - Every interactive control (`<button>`, `<a>`, `<input>`, navigation tabs) must provide a touch target area of at least **24x24 px** on desktop and **44x44 px** on mobile touch viewports (`--touch-target-min: 44px`).
   - Use CSS `min-height`, `min-width`, or generous padding wrappers to satisfy target boundaries without distorting visual typography.

2. **Focus Not Obscured [SC 2.4.11 & 2.4.12 - Level AA]:**
   - When an element receives keyboard focus (`:focus-visible`), it must never be fully or partially obscured by sticky/fixed layout containers (e.g., sticky headers, cookie consent banners, floating drawer overlays).
   - Enforce `scroll-margin-top` / `scroll-padding-top` on all targeted section anchors.
   - Mandatory visible focus ring: `:focus-visible { outline: 2px solid var(--osio-accent); outline-offset: 2px; }`.

3. **Dragging Movements [SC 2.5.7 - Level AA]:**
   - Any feature operable via dragging or swipe gestures (such as card decks or carousels) must supply an accessible single-pointer alternative (e.g., previous/next click buttons, keyboard arrow controls).

4. **Color Contrast & Terracotta Split [SC 1.4.3 & 1.4.11 - Level AA]:**
   - Normal text: minimum contrast ratio of **4.5:1** against the background.
   - Large text (18pt / 24px or 14pt bold) and essential UI components: minimum ratio of **3:1**.
   - **Terracotta Split Discipline:** Strictly apply `var(--osio-accent-text)` to readable copy, links, and badges. Reserve `var(--osio-accent)` exclusively for solid interactive fills (buttons), decorative non-text icons, and focus rings.

5. **Semantic HTML First, ARIA Second:**
   - Use native HTML elements (`<button>`, `<a>`, `<nav>`, `<main>`, `<header>`, `<footer>`, `<dialog>`) before introducing synthetic `div` elements with custom roles.
   - Never duplicate implicit roles (e.g., avoid `<nav role="navigation">` or `<button role="button">`).
   - Use `aria-*` attributes strictly for dynamic states (`aria-expanded`, `aria-current`, `aria-hidden`, `aria-live`).

6. **Keyboard Navigation & Dialog Traps:**
   - Drawers and modal dialogs must trap focus while open.
   - Pressing `Escape` must immediately dismiss the dialog and return focus to the triggering element (`opener`).
   - Provide an immediate skip link as the first focusable child in `<body>` (`<a href="#main-content" class="skip-link">Skip to content</a>`).

7. **Reduced Motion & Animation Pause:**
   - Honor `@media (prefers-reduced-motion: reduce)` by disabling non-essential transitions and parallax transforms.
   - Support the `.motion-paused` toggle on `<html>` to stop infinite CSS keyframe animations.

8. **Bidirectional Layout Mirroring (RTL Support):**
   - Strictly employ CSS Logical Properties:
     - `margin-inline-start` / `margin-inline-end` instead of `margin-left` / `margin-right`.
     - `padding-inline-start` / `padding-inline-end` instead of `padding-left` / `padding-right`.
     - `inset-inline-start` / `inset-inline-end` instead of `left` / `right`.
     - `text-align: start` / `end` instead of `text-align: left` / `right`.
   - Mirror directional icons (back/forward chevrons) dynamically when `dir="rtl"`.

---

## 2. Verification Protocol & Local Tooling

Run automated checks inside the Docker container:

1. **Static Analysis (JSX / AST a11y):**
   ```bash
   docker compose run --rm worker pnpm lint
   ```
2. **Automated Dynamic Audit (Pa11y + Axe Core):**
   ```bash
   docker compose run --rm worker pnpm audit:a11y
   ```
3. **Unit Tests (Modal focus trap, keyboard events, reduced motion):**
   ```bash
   docker compose run --rm worker npx vitest run tests/unit/lib/a11y-wcag.test.ts
   ```

---

## 3. Targeted W3C Reference Protocol (Token Efficient)

When implementing complex custom widgets (e.g., combobox, accessible treeview, tablist):
- Query specific W3C WAI-ARIA Authoring Practices using `search_web` (e.g., `w3c apwg combobox pattern`).
- Extract only the state-machine rules and keyboard interaction table. Do not ingest full specification documents.
