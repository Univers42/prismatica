import { type ThemeName, THEMES, normalizeTheme, themeDisplayName } from '../lib/theme-config';
import { motionAllowed } from '../lib/motion-preference';
import { readStorage, writeStorage } from '../lib/storage';
import { queryElements, queryElement, isButton, isHtmlElement } from '../lib/dom-utils';

const THEME_KEY = 'prismatica-theme';
const MOTION_KEY = 'prismatica-motion-paused';

/** Returns the current theme from storage or system preference. */
function initialTheme(): ThemeName {
	return normalizeTheme(readStorage(THEME_KEY)) ?? 'swiss';
}

/** Updates visible and assistive theme button labels. */
function updateThemeButton(theme: ThemeName): void {
	const buttons = queryElements('#theme-toggle, [data-theme-toggle]', isButton);
	const labels = queryElements('[data-theme-label]', isHtmlElement);
	const nextTheme = THEMES[(THEMES.indexOf(theme) + 1) % THEMES.length] ?? 'aurora';
	const themeLabel = themeDisplayName(theme);
	const nextLabel = themeDisplayName(nextTheme);
	buttons.forEach((button) => {
		button.setAttribute('aria-label', `Theme: ${themeLabel}. Switch to ${nextLabel} palette`);
		button.title = `Switch to ${nextLabel} theme`;
	});
	labels.forEach((label) => {
		label.textContent = `Theme: ${themeLabel}`;
	});
}

/** Applies a theme to the document root. */
function applyTheme(theme: ThemeName): void {
	document.documentElement.dataset.theme = theme;
	document.documentElement.style.colorScheme = theme === 'solar' ? 'light' : 'dark';
	writeStorage(THEME_KEY, theme);
	updateThemeButton(theme);
}

/** Advances the current theme. */
function cycleTheme(): void {
	const current = normalizeTheme(document.documentElement.dataset.theme ?? null);
	const index = current ? THEMES.indexOf(current) : -1;
	const nextTheme = THEMES[(index + 1) % THEMES.length] ?? 'aurora';
	applyTheme(nextTheme);
	announce(`${themeDisplayName(nextTheme)} theme enabled`);
	if (motionAllowed()) {
		document.querySelectorAll('.header-icon--theme').forEach((icon) => {
			icon.animate([{ rotate: '0deg' }, { rotate: '180deg' }], { duration: 420, easing: 'cubic-bezier(0.16, 1, 0.3, 1)' });
		});
	}
}

/** Updates visible and assistive motion button labels. */
function updateMotionButton(paused: boolean): void {
	const button = queryElement('#motion-toggle', isButton);
	const label = queryElement('[data-motion-label]', isHtmlElement);
	if (button) {
		button.setAttribute('aria-pressed', String(paused));
		button.setAttribute('aria-label', paused ? 'Resume animations' : 'Pause animations');
		button.title = paused ? 'Resume animations' : 'Pause animations';
		const icon = button.querySelector('.header-icon--motion');
		if (icon instanceof HTMLElement) {
			icon.textContent = paused ? '▶' : 'Ⅱ';
		}
	}
	if (label) {
		label.textContent = paused ? 'Resume animations' : 'Pause animations';
	}
}

/** Applies the motion preference to the page. */
function applyMotionPreference(paused: boolean): void {
	document.documentElement.classList.toggle('motion-paused', paused);
	writeStorage(MOTION_KEY, paused ? 'true' : 'false');
	updateMotionButton(paused);
	announce(paused ? 'Animations paused' : 'Animations resumed');
}

/**
 * Ensures every button has an accessible name, even if a future edit forgets one. A button
 * with text is already named by it; copying that text into aria-label would freeze the name
 * while the text changes (the portal submit kept announcing "Sign in securely" in create mode).
 */
function ensureButtonLabels(): void {
	queryElements('button', (element): element is HTMLButtonElement => element instanceof HTMLButtonElement).forEach((button) => {
		if (button.getAttribute('aria-label') || button.getAttribute('aria-labelledby') || (button.textContent ?? '').trim()) {
			return;
		}
		const label = button.title.trim();
		if (label) {
			button.setAttribute('aria-label', label);
		}
	});
}

/** Wires theme and motion preference click listeners + system preference listener. */
function bindThemeControls(): void {
	queryElement('#theme-toggle', isButton)?.addEventListener('click', cycleTheme);
	queryElements('[data-theme-toggle]', isButton).forEach((button) => button.addEventListener('click', cycleTheme));
	queryElement('#motion-toggle', isButton)?.addEventListener('click', () => applyMotionPreference(!document.documentElement.classList.contains('motion-paused')));
	window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (event) => {
		if (event.matches) {
			applyTheme('aurora');
		} else {
			applyTheme('swiss');
		}
	});
}

/** Announces dynamic state changes to assistive technology. */
function announce(message: string): void {
	let announcer = queryElement('#global-announcer', isHtmlElement);
	if (!announcer) {
		// The live region ships in Layout.astro, but guard against it being
		// missing (older cached pages, partial DOM) so announcements still
		// reach screen readers instead of silently disappearing.
		announcer = document.createElement('div');
		announcer.id = 'global-announcer';
		announcer.className = 'visually-hidden';
		announcer.setAttribute('aria-live', 'polite');
		announcer.setAttribute('aria-atomic', 'true');
		document.body.append(announcer);
	}
	announcer.textContent = message;
}

/* exports */
export { initialTheme, applyTheme, cycleTheme, applyMotionPreference, bindThemeControls, MOTION_KEY, THEME_KEY, announce, ensureButtonLabels };