// /auth/reset-password: the signed link from the reset email (scripts/auth/link-signing.mjs) is
// read from the fragment and dropped from the address bar; the new password goes with it to
// POST /api/auth/reset-password. GoTrue spends the link on the first attempt, so when the gateway
// asks for an authenticator code or refuses the password it returns a reset_ticket, and every
// later attempt sends the ticket instead of the link (scripts/auth/link-flows.mjs).
import type { AuthResult, ResetPasswordRequest, useAuth } from '../hooks/useAuth';
import { forgetFragment, readSignedLink, type SignedLink } from '../lib/auth-link';
import { checkPasswordStrength, passwordRuleResults } from '../lib/auth-validation';
import { showWhen } from '../lib/dom-utils';

type ResetClient = Pick<ReturnType<typeof useAuth>, 'resetPassword'>;
type PageLocation = Pick<Location, 'hash' | 'pathname' | 'search'>;
type PageHistory = Pick<History, 'state' | 'replaceState'>;

const NO_LINK = 'This page needs the full link from your reset email. Ask for a new one below.';
const UNAVAILABLE = 'The sign-in service did not answer. Try again in a minute.';

type ResetForm = {
	form: HTMLFormElement;
	password: HTMLInputElement;
	confirm: HTMLInputElement;
	code: HTMLInputElement;
	codeField: HTMLElement;
	submit: HTMLButtonElement;
};

function formParts(root: HTMLElement): ResetForm | null {
	const form = root.querySelector<HTMLFormElement>('[data-reset-form]');
	const field = (name: string) => form?.elements.namedItem(name);
	const [password, confirm, code] = ['password', 'confirm_password', 'code'].map(field);
	const codeField = root.querySelector<HTMLElement>('[data-reset-code-field]');
	const submit = form?.querySelector<HTMLButtonElement>('button[type="submit"]');
	if (!form || !(password instanceof HTMLInputElement) || !(confirm instanceof HTMLInputElement) || !(code instanceof HTMLInputElement) || !codeField || !submit) return null;
	return { form, password, confirm, code, codeField, submit };
}

function say(root: HTMLElement, message: string, isError: boolean): void {
	const status = root.querySelector('[data-auth-status]');
	if (!status) return;
	status.textContent = message;
	status.classList.toggle('is-error', isError);
}

// The rule items are rendered with the page; only their state changes here, so typing never
// shifts the card (Lighthouse CLS 0.053 when the list was rebuilt on load).
function renderStrength(root: HTMLElement, password: string): void {
	const meter = root.querySelector<HTMLElement>('[data-password-strength]');
	if (!meter) return;
	const strength = checkPasswordStrength(password);
	meter.dataset.strengthLevel = strength.level;
	meter.querySelectorAll('[data-password-segment]').forEach((segment, index) => segment.classList.toggle('is-filled', index < strength.score));
	const label = meter.querySelector('[data-password-strength-label]');
	if (label) label.textContent = strength.level === 'empty' ? 'Enter a password' : `${strength.level[0].toUpperCase()}${strength.level.slice(1)} password`;
	const results = passwordRuleResults(password);
	meter.querySelectorAll('[data-password-rules] li').forEach((item, index) => {
		item.classList.toggle('is-met', Boolean(results[index]?.passed));
		item.classList.toggle('is-unmet', !results[index]?.passed);
	});
}

function passwordsReady(root: HTMLElement, parts: ResetForm): boolean {
	const { password, confirm } = parts;
	renderStrength(root, password.value);
	const matches = confirm.value.length > 0 && password.value === confirm.value;
	const match = root.querySelector<HTMLElement>('[data-password-match]');
	if (match) {
		match.classList.toggle('is-match', matches);
		match.classList.toggle('is-mismatch', confirm.value.length > 0 && !matches);
		match.textContent = matches ? 'Passwords match.' : confirm.value ? 'Passwords do not match.' : 'Repeat the same password.';
	}
	return checkPasswordStrength(password.value).passed && matches;
}

function askForCode(parts: ResetForm): void {
	parts.codeField.hidden = false;
	parts.code.required = true;
	parts.code.focus();
}

export function bindResetPage(root: HTMLElement, client: ResetClient, location: PageLocation, history: PageHistory): void {
	const link: SignedLink | null = readSignedLink(location.hash, 'recovery');
	if (location.hash) forgetFragment(location, history);
	const parts = formParts(root);
	if (!link || !parts) {
		say(root, NO_LINK, true);
		showWhen(root, 'refused');
		return;
	}
	let ticket: string | undefined;
	const refresh = () => {
		parts.submit.disabled = !passwordsReady(root, parts);
	};
	parts.form.querySelectorAll('input').forEach((input) => input.addEventListener('input', refresh));
	refresh();

	const settle = (result: AuthResult) => {
		ticket = result.resetTicket ?? ticket;
		if (result.ok) {
			say(root, result.message, false);
			showWhen(root, 'done');
		} else if (result.status === 410) {
			say(root, result.message, true);
			showWhen(root, 'refused');
		} else if (result.code === 'mfa_required') {
			say(root, result.message, false);
			askForCode(parts);
		} else {
			say(root, result.message, true);
			(result.code === 'mfa_invalid' ? parts.code : parts.password).focus();
		}
	};

	parts.form.addEventListener('submit', async (event) => {
		event.preventDefault();
		if (!passwordsReady(root, parts)) return;
		const code = parts.codeField.hidden ? undefined : parts.code.value.trim();
		const credential = ticket ? { reset_ticket: ticket } : link;
		const request: ResetPasswordRequest = { ...credential, password: parts.password.value, ...(code ? { code } : {}) };
		parts.submit.disabled = true;
		parts.submit.setAttribute('aria-busy', 'true');
		say(root, 'Changing your password…', false);
		try {
			settle(await client.resetPassword(request));
		} catch {
			say(root, UNAVAILABLE, true);
		} finally {
			parts.submit.removeAttribute('aria-busy');
			refresh();
		}
	});
}
