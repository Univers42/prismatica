/* Sign in with an emailed code, no password. The request step reads the address and Turnstile
   token from the password form; the code step is its own form so Cancel returns to the password
   form. The session hand-off is the password login's (`onSession`). */

import { useAuth } from '../hooks/useAuth';
import { say } from './portal-login-code';

export function signInCodeMarkup(): string {
	return `
		<form class="portal-signin-code" novalidate hidden>
			<p class="portal-note">If an account can receive mail at that address, we emailed it a 6-digit code. It works once and expires in 10 minutes.</p>
			<div class="field">
				<label for="portal-signin-code">Sign-in code</label>
				<input id="portal-signin-code" name="code" type="text" inputmode="numeric" autocomplete="one-time-code" pattern="\\d{6}" maxlength="6" placeholder="123456" required />
			</div>
			<output class="portal-form-error" data-signin-code-error aria-live="polite" hidden></output>
			<button class="button button--primary button--full" type="submit" data-signin-code-submit>Sign in</button>
			<div class="portal-alt-actions">
				<button class="portal-link-action" type="button" data-signin-code-cancel>Cancel</button>
			</div>
		</form>
	`;
}

type Auth = Pick<ReturnType<typeof useAuth>, 'requestSignInCode' | 'verifySignInCode'>;

type SignInCodeHooks = {
	auth: Auth;
	passwordForm: HTMLFormElement;
	email: () => string;
	turnstileToken: () => string;
	onSession: (accessToken: string | undefined) => Promise<void>;
};

export function bindSignInCode(portal: HTMLElement, hooks: SignInCodeHooks): void {
	const step = portal.querySelector<HTMLFormElement>('form.portal-signin-code');
	const input = step?.querySelector<HTMLInputElement>('input[name="code"]');
	const error = step?.querySelector<HTMLElement>('[data-signin-code-error]');
	const submit = step?.querySelector<HTMLButtonElement>('[data-signin-code-submit]');
	const trigger = portal.querySelector<HTMLButtonElement>('[data-portal-action="email-code"]');
	const passwordError = hooks.passwordForm.querySelector<HTMLElement>('.portal-form-error');
	if (!step || !input || !error || !submit || !trigger || !passwordError) return;

	trigger.addEventListener('click', () => {
		const token = hooks.turnstileToken();
		if (!token) return say(passwordError, 'Please complete the verification check before submitting.');
		trigger.disabled = true;
		void hooks.auth.requestSignInCode({ email: hooks.email(), turnstileToken: token }).then((result) => {
			if (!result.ok) return say(passwordError, result.message);
			say(passwordError, '');
			hooks.passwordForm.hidden = true;
			step.hidden = false;
			input.focus();
		}).finally(() => {
			trigger.disabled = false;
		});
	});

	step.addEventListener('submit', (event) => {
		event.preventDefault();
		submit.disabled = true;
		say(error, '');
		void hooks.auth.verifySignInCode({ email: hooks.email(), turnstileToken: hooks.turnstileToken(), code: input.value.trim() }).then(async (result) => {
			if (result.ok) await hooks.onSession(result.accessToken);
			else say(error, result.message);
		}).finally(() => {
			submit.disabled = false;
		});
	});

	step.querySelector('[data-signin-code-cancel]')?.addEventListener('click', () => {
		input.value = '';
		say(error, '');
		step.hidden = true;
		hooks.passwordForm.hidden = false;
	});
}
