// The portal's two email-only forms: ask for a password reset link, or for a new confirmation
// link. Both reuse the sign-in form with the password hidden, and the gateway gives both the same
// answer whether or not the address has an account (scripts/auth/account-mail.mjs), so the
// gateway's own sentence is what the visitor reads.
import { NO_GATEWAY_MESSAGE } from '../hooks/useAuth';

export type AccountMailKind = 'recovery' | 'resend';

const COPY: Record<AccountMailKind, { title: string; note: string; submit: string; done: string }> = {
	recovery: {
		title: 'Reset your password',
		note: 'Enter your account email and we will send you a link to choose a new password.',
		submit: 'Send reset link',
		done: 'If an account uses this address, a reset link has been sent to it. Check your inbox.',
	},
	resend: {
		title: 'Confirm your email',
		note: 'Enter the email you signed up with. We send a new confirmation link; older links stop working.',
		submit: 'Send a new link',
		done: 'A new confirmation link is on its way. Check your inbox.',
	},
};

export function isAccountMailKind(value: unknown): value is AccountMailKind {
	return value === 'recovery' || value === 'resend';
}

export function accountMailSubmitLabel(kind: AccountMailKind): string {
	return COPY[kind].submit;
}

export function accountMailDoneMessage(kind: AccountMailKind, gatewayMessage: string): string {
	return gatewayMessage === NO_GATEWAY_MESSAGE ? COPY[kind].done : gatewayMessage;
}

function passwordField(portal: HTMLElement): { input: HTMLInputElement | null; field: HTMLElement | null } {
	const input = portal.querySelector<HTMLInputElement>('#portal-password');
	return { input, field: input?.closest<HTMLElement>('.field') ?? null };
}

export function showAccountMailForm(portal: HTMLElement, kind: AccountMailKind): void {
	portal.dataset.portalMode = kind;
	const { input, field } = passwordField(portal);
	if (input) input.required = false;
	if (field) field.hidden = true;
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
	delete portal.dataset.portalMode;
	const { input, field } = passwordField(portal);
	if (input) input.required = true;
	if (field) field.hidden = false;
}
