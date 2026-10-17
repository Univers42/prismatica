/* The portal's waiting step when the gateway answers mfa_required 'email_approve': the user taps
   Approve in the mail on another device and types the number shown here. This step only polls; the
   session is released by the gateway to this browser, never to the approving device. */

import type { useAuth, AuthResult } from '../hooks/useAuth';
import { say, showLoginCodeStep } from './portal-login-code';

export const POLL_START_MS = 2500;
export const POLL_MAX_MS = 6000;
// Caveat: mirrors the gateway's 600 s ticket; if the server TTL changes this stops polling early or late.
export const WAIT_LIMIT_MS = 600_000;

export function loginApproveMarkup(): string {
	return `
		<section class="portal-login-approve" hidden aria-live="polite">
			<p class="portal-note">Open the mail on your phone, tap Approve, type this number: <strong class="portal-approve-number" data-login-approve-number></strong></p>
			<output class="portal-form-error" data-login-approve-error hidden></output>
			<div class="portal-alt-actions">
				<button class="portal-link-action" type="button" data-login-approve-code>Email me a code instead</button>
				<button class="portal-link-action" type="button" data-login-approve-cancel>Cancel</button>
			</div>
		</section>
	`;
}

type Auth = Pick<ReturnType<typeof useAuth>, 'pollLoginApproval' | 'resendLoginCode'>;

type ApproveHooks = {
	auth: Auth;
	passwordForm: HTMLFormElement;
	onSession: (accessToken: string | undefined) => Promise<void>;
};

let stopPolling: () => void = () => undefined;
let beginPolling: () => void = () => undefined;

export function showLoginApproveStep(portal: HTMLElement, passwordForm: HTMLFormElement, match: number | undefined): void {
	const step = portal.querySelector<HTMLElement>('section.portal-login-approve');
	const number = step?.querySelector<HTMLElement>('[data-login-approve-number]');
	if (!step || !number) return;
	number.textContent = match === undefined ? '' : String(match);
	passwordForm.hidden = true;
	step.hidden = false;
	beginPolling();
}

export function bindLoginApproveStep(portal: HTMLElement, hooks: ApproveHooks): void {
	const step = portal.querySelector<HTMLElement>('section.portal-login-approve');
	const error = step?.querySelector<HTMLElement>('[data-login-approve-error]');
	if (!step || !error) return;

	const leave = (message: string): void => {
		stopPolling();
		say(error, '');
		step.hidden = true;
		hooks.passwordForm.hidden = false;
		const passwordError = hooks.passwordForm.querySelector<HTMLElement>('.portal-form-error');
		if (passwordError) say(passwordError, message);
	};

	const poll = (): void => {
		stopPolling();
		const startedAt = Date.now();
		let delayMs = POLL_START_MS;
		let timer: ReturnType<typeof setTimeout> | undefined;
		let stopped = false;
		stopPolling = () => {
			stopped = true;
			if (timer) clearTimeout(timer);
		};
		const tick = async (): Promise<void> => {
			if (stopped) return;
			if (Date.now() - startedAt > WAIT_LIMIT_MS) return leave('The sign-in request expired. Sign in again.');
			const result: AuthResult = await hooks.auth.pollLoginApproval();
			if (stopped) return;
			if (result.ok && result.pending) {
				delayMs = Math.min(Math.round(delayMs * 1.2), POLL_MAX_MS);
			} else if (result.ok) {
				stopPolling();
				return hooks.onSession(result.accessToken);
			} else if (result.status !== 429) {
				return leave(result.message);
			}
			timer = setTimeout(() => void tick(), delayMs);
		};
		timer = setTimeout(() => void tick(), delayMs);
	};

	beginPolling = poll;

	step.querySelector('[data-login-approve-code]')?.addEventListener('click', () => {
		void hooks.auth.resendLoginCode().then((result) => {
			if (result.ok) {
				stopPolling();
				step.hidden = true;
				showLoginCodeStep(portal, hooks.passwordForm);
			} else say(error, result.message);
		});
	});

	step.querySelector('[data-login-approve-cancel]')?.addEventListener('click', () => leave(''));
}
