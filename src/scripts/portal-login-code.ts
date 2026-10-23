/* The portal's second login step: the 6-digit code the gateway mails after a correct password
   (AUTH_LOGIN_EMAIL_OTP). The password form stays in the DOM, hidden, so Cancel returns to it. */

import { useAuth, type AuthResult } from '../hooks/useAuth';

export function loginCodeMarkup(): string {
	return `
		<form class="portal-login-code" novalidate hidden>
			<p class="portal-note">We emailed a 6-digit code to your address. It expires in a few minutes.</p>
			<div class="field">
				<label for="portal-login-code">Sign-in code</label>
				<input id="portal-login-code" name="code" type="text" inputmode="numeric" autocomplete="one-time-code" pattern="\\d{6}" maxlength="6" placeholder="123456" required />
			</div>
			<output class="portal-form-error" data-login-code-error aria-live="polite" hidden></output>
			<button class="button button--primary button--full" type="submit" data-login-code-submit>Verify code</button>
			<div class="portal-alt-actions">
				<button class="portal-link-action" type="button" data-login-code-resend>Resend code</button>
				<button class="portal-link-action" type="button" data-login-code-cancel>Cancel</button>
			</div>
		</form>
	`;
}

type Auth = Pick<ReturnType<typeof useAuth>, 'verifyLoginCode' | 'resendLoginCode'>;

type CodeStepHooks = {
	auth: Auth;
	passwordForm: HTMLFormElement;
	/** Runs the same hand-off a password-only login ends with. */
	onSession: (accessToken: string | undefined) => Promise<void>;
};

export function say(error: HTMLElement, text: string): void {
	error.textContent = text;
	error.toggleAttribute('hidden', text === '');
}

// 401 otp_invalid is the only answer that keeps the ticket; every other failure ends the attempt.
const KEEPS_TICKET = new Set(['otp_invalid', 'otp_malformed', 'otp_unavailable', 'otp_resend_wait', 'otp_resend_limit', 'otp_send_failed', 'rate_limited']);

export function showLoginCodeStep(portal: HTMLElement, passwordForm: HTMLFormElement): void {
	const step = portal.querySelector<HTMLFormElement>('form.portal-login-code');
	if (!step) return;
	passwordForm.hidden = true;
	step.hidden = false;
	step.querySelector<HTMLInputElement>('input[name="code"]')?.focus();
}

export function bindLoginCodeStep(portal: HTMLElement, hooks: CodeStepHooks): void {
	const step = portal.querySelector<HTMLFormElement>('form.portal-login-code');
	const input = step?.querySelector<HTMLInputElement>('input[name="code"]');
	const error = step?.querySelector<HTMLElement>('[data-login-code-error]');
	const submit = step?.querySelector<HTMLButtonElement>('[data-login-code-submit]');
	if (!step || !input || !error || !submit) return;

	const leave = (message: string): void => {
		input.value = '';
		say(error, '');
		step.hidden = true;
		hooks.passwordForm.hidden = false;
		const passwordError = hooks.passwordForm.querySelector<HTMLElement>('.portal-form-error');
		if (passwordError) say(passwordError, message);
	};

	const settle = async (result: AuthResult): Promise<void> => {
		if (result.ok) {
			await hooks.onSession(result.accessToken);
			return;
		}
		if (result.code && !KEEPS_TICKET.has(result.code)) {
			leave(result.message);
			return;
		}
		say(error, result.message);
		input.select();
	};

	step.addEventListener('submit', (event) => {
		event.preventDefault();
		submit.disabled = true;
		say(error, '');
		void hooks.auth.verifyLoginCode(input.value.trim()).then(settle).finally(() => {
			submit.disabled = false;
		});
	});

	step.querySelector('[data-login-code-resend]')?.addEventListener('click', () => {
		void hooks.auth.resendLoginCode().then((result) => {
			if (result.code && !KEEPS_TICKET.has(result.code)) leave(result.message);
			else say(error, result.ok ? 'A new code is on its way.' : result.message);
		});
	});

	step.querySelector('[data-login-code-cancel]')?.addEventListener('click', () => leave(''));
}
