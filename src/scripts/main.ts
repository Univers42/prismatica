// Starts every page: the theme toggle, the view tabs and the tour dialog. The heavy parts (the
// sign-in portal with @grobase/js, the newsletter submit) are imported on first use, so initial
// JavaScript stays inside the 30 KB budget (groot docs/redesign/PLAN.md §8.2).
import { bindSkipLinkFocus } from '../lib/a11y';
import { bindThemeToggle, ensureButtonLabels } from './theme';
import { bindTourDialog } from './tour';
import { bindViewTabs } from './views';

function closestFromEvent(event: Event, selector: string): Element | null {
	return event.target instanceof Element ? event.target.closest(selector) : null;
}

function bindPortalTriggers(): void {
	document.addEventListener('click', (event) => {
		const trigger = closestFromEvent(event, '[data-open-portal], [data-open-connect]');
		if (!trigger) return;
		event.preventDefault();
		const mode = trigger.hasAttribute('data-open-connect') ? 'connect' : 'start';
		document.querySelector<HTMLDialogElement>('dialog[data-tour-dialog][open]')?.close();
		void import('./portal').then(({ openPortal }) => openPortal(mode));
	});
}

// Captures every newsletter submit, even before its module has loaded: a native submit would put
// the address in the page URL.
function bindNewsletterForms(): void {
	document.addEventListener('submit', (event) => {
		const form = closestFromEvent(event, 'form[data-newsletter-signup]');
		if (!(form instanceof HTMLFormElement)) return;
		event.preventDefault();
		void import('./newsletter').then(({ submitNewsletter }) => submitNewsletter(form));
	});
}

bindSkipLinkFocus();
bindThemeToggle();
bindViewTabs();
bindTourDialog();
bindPortalTriggers();
bindNewsletterForms();
ensureButtonLabels();
