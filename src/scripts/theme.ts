import { type ThemeChoice, THEME_KEY, normalizeTheme, nextTheme, themeLabel } from '../lib/theme-config';
import { readStorage, writeStorage } from '../lib/storage';
import { queryElements, queryElement, isButton, isHtmlElement } from '../lib/dom-utils';

// "system" leaves data-theme off <html>, so the stylesheet's prefers-color-scheme block decides.
// prepaint.js applies a stored light or dark choice before first paint (no flash); this module
// keeps the toggle in sync afterwards.

function currentTheme(): ThemeChoice {
	return normalizeTheme(readStorage(THEME_KEY));
}

function reflectToggle(choice: ThemeChoice): void {
	const next = themeLabel(nextTheme(choice));
	queryElements('[data-theme-toggle]', isButton).forEach((button) => {
		button.setAttribute('aria-label', `Theme: ${themeLabel(choice)}. Switch to ${next}`);
		button.dataset.themeChoice = choice;
	});
}

function applyTheme(choice: ThemeChoice): void {
	const root = document.documentElement;
	if (choice === 'system') delete root.dataset.theme;
	else root.dataset.theme = choice;
	writeStorage(THEME_KEY, choice);
	reflectToggle(choice);
}

function cycleTheme(): void {
	const choice = nextTheme(currentTheme());
	const swap = (): void => applyTheme(choice);
	const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
	const viewTransition = (document as Document & { startViewTransition?: (cb: () => void) => unknown }).startViewTransition;
	if (viewTransition && !reduced) viewTransition.call(document, swap);
	else swap();
	announce(`${themeLabel(choice)} theme`);
}

function bindThemeToggle(): void {
	const choice = currentTheme();
	// A name from the old five-theme site is rewritten once, so the pre-paint script reads it next time.
	if (readStorage(THEME_KEY) !== null && readStorage(THEME_KEY) !== choice) applyTheme(choice);
	else reflectToggle(choice);
	queryElements('[data-theme-toggle]', isButton).forEach((button) => button.addEventListener('click', cycleTheme));
}

/** Announces dynamic state changes to assistive technology. */
function announce(message: string): void {
	const announcer = queryElement('#global-announcer', isHtmlElement);
	if (announcer) announcer.textContent = message;
}

/**
 * Ensures every button has an accessible name, even if a future edit forgets one. A button
 * with text is already named by it; copying that text into aria-label would freeze the name
 * while the text changes (the portal submit kept announcing "Sign in securely" in create mode).
 */
function ensureButtonLabels(): void {
	queryElements('button', (element): element is HTMLButtonElement => element instanceof HTMLButtonElement).forEach((button) => {
		if (button.getAttribute('aria-label') || button.getAttribute('aria-labelledby') || (button.textContent ?? '').trim()) return;
		const label = button.title.trim();
		if (label) button.setAttribute('aria-label', label);
	});
}

export { applyTheme, bindThemeToggle, currentTheme, announce, ensureButtonLabels };
