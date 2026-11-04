// Starts every page: the theme toggle, the view tabs and the tour dialog. The heavy parts (the
// sign-in portal with @grobase/js, the newsletter submit) are imported on first use, so initial
// JavaScript stays inside the 30 KB budget (groot docs/redesign/PLAN.md §8.2). A portal trigger
// names its form: data-open-connect signs in, data-open-portal signs up, or with the value
// "recovery" or "resend" asks for a reset or a new confirmation link.
import { bindSkipLinkFocus } from '../lib/a11y';
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
bindSavedView();
bindTourDialog();
bindPortalTriggers();
bindNewsletterForms();
ensureButtonLabels();
