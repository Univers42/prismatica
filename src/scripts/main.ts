// Starts every page: the theme toggle, the consent banner, the view tabs and the tour dialog. The
// heavy parts (the sign-in portal with @grobase/js, the language dictionary, the data-rights forms,
// the newsletter submit) are imported on first use, so initial JavaScript stays inside the 30 KB
// budget (groot docs/redesign/PLAN.md §8.2). A portal trigger names its form: data-open-connect
// signs in, data-open-portal signs up, or with the value "recovery" or "resend" asks for a reset
// or a new confirmation link.
import { bindSkipLinkFocus } from '../lib/a11y';
import { bindConsentBanner } from './consent';
import { bindThemeToggle, ensureButtonLabels } from './theme';
import { bindTourDialog } from './tour';
import { bindViewTabs } from './views';
import { bindSavedView } from './saved-view';
import { isAccountMailKind } from './portal-account-mail';

function closestFromEvent(event: Event, selector: string): Element | null {
	return event.target instanceof Element ? event.target.closest(selector) : null;
}

function bindPortalTriggers(): void {
	document.addEventListener('click', (event) => {
		const trigger = closestFromEvent(event, '[data-open-portal], [data-open-connect]');
		if (!trigger) return;
		event.preventDefault();
		const requested = trigger.getAttribute('data-open-portal');
		const mode = trigger.hasAttribute('data-open-connect') ? 'connect' : isAccountMailKind(requested) ? requested : 'start';
		document.querySelector<HTMLDialogElement>('dialog[data-tour-dialog][open]')?.close();
		void import('./portal').then(({ openPortal }) => openPortal(mode));
	});
}

// Captures every newsletter submit, even before its module has loaded: a native submit would put
// the address in the page URL. The first focus inside the form mounts its Turnstile widget.
function bindNewsletterForms(): void {
	document.addEventListener('focusin', (event) => {
		const form = closestFromEvent(event, 'form[data-newsletter-signup]');
		if (form instanceof HTMLFormElement) void import('./newsletter').then(({ prepareNewsletter }) => prepareNewsletter(form));
	});
	document.addEventListener('submit', (event) => {
		const form = closestFromEvent(event, 'form[data-newsletter-signup]');
		if (!(form instanceof HTMLFormElement)) return;
		event.preventDefault();
		void import('./newsletter').then(({ submitNewsletter }) => submitNewsletter(form));
	});
}

// English is in the HTML, so a visitor who never leaves it never fetches the dictionary. The
// pre-paint script has already set <html lang dir> for anyone else, so only the text is left.
// Caveat: that text stays English until the chunk arrives, one round trip after first paint, so a
// visitor returning in Spanish or Arabic sees it swap; a static page cannot know the language sooner.
function bindLanguage(): void {
	document.addEventListener('click', (event) => {
		if (!closestFromEvent(event, '.lang-switcher')) return;
		event.preventDefault();
		void import('./language').then(({ cycleLocale }) => cycleLocale());
	});
	window.addEventListener('popstate', () => {
		void import('./language').then(({ applyLocale, initialLocale }) => applyLocale(initialLocale()));
	});
	if (document.documentElement.lang !== 'en') {
		void import('./language').then(({ applyLocale, initialLocale }) => applyLocale(initialLocale()));
	}
}

// A <details> opens with no script; closing on a choice or on Escape (WCAG 2.1.2) needs one line.
function bindSiteMenu(): void {
	const menu = document.querySelector<HTMLDetailsElement>('details.site-menu');
	if (!menu) return;
	menu.querySelector('.site-menu__panel')?.addEventListener('click', (event) => {
		if (closestFromEvent(event, 'a[href], button')) menu.open = false;
	});
	document.addEventListener('keydown', (event) => {
		if (event.key !== 'Escape' || !menu.open) return;
		menu.open = false;
		menu.querySelector('summary')?.focus();
	});
}

// The data-rights page is main's legal page, unchanged, and it carries no script of its own.
function bindDataRights(): void {
	if (!document.querySelector('[data-gdpr-request-form], [data-gdpr-account]')) return;
	void import('./data-rights').then(({ bindDataRightsPage }) => bindDataRightsPage());
}

bindSkipLinkFocus();
bindThemeToggle();
bindSiteMenu();
bindConsentBanner();
bindViewTabs();
bindSavedView();
bindTourDialog();
bindPortalTriggers();
bindNewsletterForms();
bindLanguage();
bindDataRights();
ensureButtonLabels();
