// The portal's two email-only forms: ask for a password reset link, or for a new confirmation
// link. Both reuse the sign-in form with the password hidden, and both get the same 202 answer
// from the gateway whether or not the address has an account (scripts/auth/account-mail.mjs).
export type AccountMailKind = 'recovery' | 'resend';

const COPY: Record<AccountMailKind, { title: string; note: string; submit: string }> = {
	recovery: {
		title: 'Reset your password',
		note: 'Enter the email of your account. We send a link to choose a new password; it works for one hour.',
		submit: 'Send reset link',
	},
	resend: {
		title: 'Confirm your email',
		note: 'Enter the email you signed up with. We send a new confirmation link; older links stop working.',
		submit: 'Send a new link',
	},
};

export function isAccountMailKind(value: unknown): value is AccountMailKind {
	return value === 'recovery' || value === 'resend';
}

function setHidden(portal: HTMLElement, selector: string, hidden: boolean): void {
	portal.querySelectorAll<HTMLElement>(selector).forEach((element) => {
		element.hidden = hidden;
	});
}

export function showAccountMailForm(portal: HTMLElement, kind: AccountMailKind): void {
	portal.dataset.portalMode = kind;
	setHidden(portal, '.portal-register-only, .portal-password-only, .portal-auth-only', true);
	setHidden(portal, '.portal-mail-only', false);
	const password = portal.querySelector<HTMLInputElement>('#portal-password');
	if (password) password.required = false;
	const copy = COPY[kind];
	const title = portal.querySelector('[data-auth-title]');
	const note = portal.querySelector('[data-auth-note]');
	const submit = portal.querySelector('[data-auth-submit]');
	if (title) title.textContent = copy.title;
	if (note) note.textContent = copy.note;
	if (submit) submit.textContent = copy.submit;
}

/** Back to the sign-in or sign-up form; the caller then applies that mode's own fields and copy. */
export function showAuthForm(portal: HTMLElement): void {
	portal.dataset.portalMode = 'auth';
	setHidden(portal, '.portal-password-only, .portal-auth-only', false);
	setHidden(portal, '.portal-mail-only', true);
	const password = portal.querySelector<HTMLInputElement>('#portal-password');
	if (password) password.required = true;
}
