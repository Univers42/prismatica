import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { openPortal, closePortal, bindPasswordToggles, readTurnstileToken } from '../../../src/scripts/portal';

describe('Portal Script Module', () => {
	beforeEach(() => {
		document.body.innerHTML = '';
	});

	afterEach(() => {
		closePortal();
		document.body.innerHTML = '';
	});

	it('opens portal and adds modal dialog to body', () => {
		openPortal('start');
		const portal = document.querySelector('#portal');
		expect(portal).not.toBeNull();
		expect(portal?.classList.contains('portal')).toBe(true);
		expect(document.body.classList.contains('portal-open')).toBe(true);
	});

	it('closes portal and cleans up body classes', () => {
		openPortal('start');
		expect(document.body.classList.contains('portal-open')).toBe(true);
		closePortal();
		expect(document.body.classList.contains('portal-open')).toBe(false);
	});

	it('opens in sign-in mode with the sign-up fields hidden and optional', () => {
		openPortal('connect');
		const portal = document.querySelector<HTMLElement>('#portal');
		const confirm = document.querySelector<HTMLInputElement>('#portal-confirm-password');
		expect(portal?.dataset.authMode).toBe('login');
		expect(confirm?.closest<HTMLElement>('.portal-register-only')?.hidden).toBe(true);
		expect(confirm?.required).toBe(false);
	});

	it('opens in sign-up mode with the sign-up fields shown and required', () => {
		openPortal('start');
		const portal = document.querySelector<HTMLElement>('#portal');
		const confirm = document.querySelector<HTMLInputElement>('#portal-confirm-password');
		expect(portal?.dataset.authMode).toBe('register');
		expect(confirm?.closest<HTMLElement>('.portal-register-only')?.hidden).toBe(false);
		expect(confirm?.required).toBe(true);
	});

	it('sends the token the auth gateway bypasses locally when no Turnstile site key is set', () => {
		openPortal('start');
		const portal = document.querySelector<HTMLElement>('#portal');
		if (!portal) throw new Error('no portal');
		// scripts/auth-gateway.mjs verifyTurnstile: TURNSTILE_BYPASS_LOCAL admits only this value.
		expect(document.querySelector<HTMLInputElement>('[data-turnstile-token]')?.value).toBe('localhost-turnstile-token');
		expect(readTurnstileToken(portal)).toBe('localhost-turnstile-token');
	});

	it('marks the active mode button pressed after a switch', () => {
		openPortal('start');
		document.querySelector<HTMLButtonElement>('[data-auth-switch="login"]')?.click();
		expect(document.querySelector('[data-auth-switch="login"]')?.getAttribute('aria-pressed')).toBe('true');
		expect(document.querySelector('[data-auth-switch="register"]')?.getAttribute('aria-pressed')).toBe('false');
	});

	it('draws the password meter without an HTML string sink', () => {
		openPortal('start');
		const meter = document.querySelector<HTMLElement>('[data-password-strength-container]');
		// The site's CSP requires Trusted Types: a plain string assigned to innerHTML throws.
		Object.defineProperty(meter, 'innerHTML', {
			set: () => {
				throw new TypeError("This document requires 'TrustedHTML' assignment.");
			},
		});
		const password = document.querySelector<HTMLInputElement>('#portal-password');
		if (!password) throw new Error('no password field');
		password.value = 'Abcdefgh12';
		password.dispatchEvent(new Event('input'));
		expect(meter?.querySelector<HTMLElement>('.password-meter__bar')?.style.width).toMatch(/%$/);
		expect(meter?.querySelector('.password-meter__label')?.textContent).not.toBe('');
	});

	it('binds password toggle buttons to switch input type', () => {
		document.body.innerHTML = `
			<div class="field">
				<input id="test-pwd" type="password" value="secret123" />
				<button type="button" data-password-toggle aria-pressed="false" aria-label="Show password">
					<span class="header-icon--toggle">Show</span>
				</button>
			</div>
		`;
		bindPasswordToggles(document.body);
		const button = document.querySelector<HTMLButtonElement>('[data-password-toggle]');
		const input = document.querySelector<HTMLInputElement>('#test-pwd');
		expect(button).not.toBeNull();
		expect(input).not.toBeNull();

		button?.click();
		expect(input?.type).toBe('text');
		expect(button?.getAttribute('aria-pressed')).toBe('true');

		button?.click();
		expect(input?.type).toBe('password');
		expect(button?.getAttribute('aria-pressed')).toBe('false');
	});

	it('shows the gateway message and a "Send a new link" button after 403 email_not_confirmed, and resends through the gateway', async () => {
		const message = 'Confirm your email first \u2014 check your inbox, or send a new link.';
		const fetchMock = vi.fn(async (url: string, _init?: RequestInit) => (String(url).endsWith('/login')
			? new Response(JSON.stringify({ error: 'email_not_confirmed', message }), { status: 403 })
			: new Response(JSON.stringify({ message: 'ok' }), { status: 202 })));
		vi.stubGlobal('fetch', fetchMock);
		try {
			openPortal('connect');
			const email = document.querySelector<HTMLInputElement>('#portal-email');
			const password = document.querySelector<HTMLInputElement>('#portal-password');
			if (!email || !password) throw new Error('no fields');
			email.value = 'ines@arlet.test';
			password.value = 'Abcdefgh12!';
			const resend = document.querySelector<HTMLButtonElement>('[data-resend-verification]');
			expect(resend?.hidden).toBe(true);
			document.querySelector<HTMLFormElement>('form.portal-login')?.dispatchEvent(new Event('submit', { cancelable: true }));
			await vi.waitFor(() => expect(resend?.hidden).toBe(false));
			expect(document.querySelector('.portal-form-error')?.textContent).toBe(message);
			resend?.click();
			await vi.waitFor(() => expect(fetchMock.mock.calls.some(([url]) => String(url).endsWith('/resend-verification'))).toBe(true));
			const call = fetchMock.mock.calls.find(([url]) => String(url).endsWith('/resend-verification'));
			expect(JSON.parse(String(call?.[1]?.body))).toMatchObject({ email: 'ines@arlet.test' });
		} finally {
			vi.unstubAllGlobals();
		}
	});
});

describe('Portal login code step', () => {
	afterEach(() => {
		closePortal();
		document.body.innerHTML = '';
		vi.unstubAllGlobals();
	});

	function gateway(routes: Record<string, () => Response>) {
		const fetchMock = vi.fn(async (url: string, _init?: RequestInit) => {
			const route = Object.keys(routes).find((suffix) => String(url).endsWith(suffix));
			return route ? routes[route]() : new Response('{}', { status: 200 });
		});
		vi.stubGlobal('fetch', fetchMock);
		return fetchMock;
	}

	const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status });

	async function signInIntoCodeStep() {
		openPortal('connect');
		document.querySelector<HTMLInputElement>('#portal-email')!.value = 'ines@arlet.test';
		document.querySelector<HTMLInputElement>('#portal-password')!.value = 'Abcdefgh12!';
		document.querySelector<HTMLFormElement>('form.portal-login')?.dispatchEvent(new Event('submit', { cancelable: true }));
		await vi.waitFor(() => expect(document.querySelector<HTMLElement>('form.portal-login-code')?.hidden).toBe(false));
	}

	const codeForm = () => document.querySelector<HTMLFormElement>('form.portal-login-code')!;
	const codeInput = () => document.querySelector<HTMLInputElement>('#portal-login-code')!;
	const codeError = () => document.querySelector<HTMLElement>('[data-login-code-error]')!;

	it('ships the code step hidden, as an accessible one-time-code field', () => {
		openPortal('connect');
		expect(codeForm().hidden).toBe(true);
		const input = codeInput();
		expect(input.getAttribute('inputmode')).toBe('numeric');
		expect(input.getAttribute('autocomplete')).toBe('one-time-code');
		expect(input.getAttribute('pattern')).toBe(String.raw`\d{6}`);
		expect(input.maxLength).toBe(6);
		expect(codeForm().querySelector('label[for="portal-login-code"]')?.textContent).toBeTruthy();
		expect(codeError().getAttribute('aria-live')).toBe('polite');
		expect(codeForm().querySelector('[data-login-code-resend]')?.textContent).toBe('Resend code');
		expect(codeForm().querySelector('[data-login-code-cancel]')?.textContent).toBe('Cancel');
	});

	it('swaps the password form for the code step when login answers mfa_required, with no token kept', async () => {
		gateway({ '/login': () => json(200, { mfa_required: 'email_otp' }) });
		await signInIntoCodeStep();
		expect(document.querySelector<HTMLElement>('form.portal-login')?.hidden).toBe(true);
	});

	it('posts the code to the verify route and continues with the session it returns', async () => {
		// The bridge answers an untrusted redirect on purpose: the hand-off is reached and stops there.
		vi.spyOn(console, 'error').mockImplementation(() => undefined);
		const fetchMock = gateway({
			'/login': () => json(200, { mfa_required: 'email_otp' }),
			'/mfa/email/verify': () => json(200, { access_token: 'at-1', expires_in: 3600 }),
			'/osionos-session': () => json(200, { redirectUrl: 'https://evil.example/x' }),
		});
		await signInIntoCodeStep();
		codeInput().value = '123456';
		codeForm().dispatchEvent(new Event('submit', { cancelable: true }));
		await vi.waitFor(() => expect(fetchMock.mock.calls.some(([url]) => String(url).endsWith('/osionos-session'))).toBe(true));
		const verify = fetchMock.mock.calls.find(([url]) => String(url).endsWith('/mfa/email/verify'));
		expect(JSON.parse(String(verify?.[1]?.body))).toEqual({ code: '123456' });
		expect((verify?.[1] as RequestInit).credentials).toBe('include');
		const bridge = fetchMock.mock.calls.find(([url]) => String(url).endsWith('/osionos-session'));
		expect((bridge?.[1]?.headers as Record<string, string>).Authorization).toBe('Bearer at-1');
	});

	it('refuses a malformed code in the browser without calling the gateway', async () => {
		const fetchMock = gateway({ '/login': () => json(200, { mfa_required: 'email_otp' }) });
		await signInIntoCodeStep();
		codeInput().value = '12ab';
		codeForm().dispatchEvent(new Event('submit', { cancelable: true }));
		await vi.waitFor(() => expect(codeError().hidden).toBe(false));
		expect(codeError().textContent).toMatch(/6-digit/);
		expect(fetchMock.mock.calls.some(([url]) => String(url).endsWith('/mfa/email/verify'))).toBe(false);
	});

	it('keeps the step open on a wrong code and shows the gateway message in the live region', async () => {
		gateway({
			'/login': () => json(200, { mfa_required: 'email_otp' }),
			'/mfa/email/verify': () => json(401, { error: 'otp_invalid', message: 'That code is not right.' }),
		});
		await signInIntoCodeStep();
		codeInput().value = '000000';
		codeForm().dispatchEvent(new Event('submit', { cancelable: true }));
		await vi.waitFor(() => expect(codeError().textContent).toBe('That code is not right.'));
		expect(codeForm().hidden).toBe(false);
	});

	it('returns to the password form with the message when the code expired', async () => {
		gateway({
			'/login': () => json(200, { mfa_required: 'email_otp' }),
			'/mfa/email/verify': () => json(410, { error: 'otp_expired', message: 'The code expired. Sign in again.' }),
		});
		await signInIntoCodeStep();
		codeInput().value = '999999';
		codeForm().dispatchEvent(new Event('submit', { cancelable: true }));
		await vi.waitFor(() => expect(codeForm().hidden).toBe(true));
		expect(document.querySelector<HTMLElement>('form.portal-login')?.hidden).toBe(false);
		expect(document.querySelector('form.portal-login .portal-form-error')?.textContent).toBe('The code expired. Sign in again.');
	});

	it('resends through the gateway and says so; Cancel returns to the password form', async () => {
		const fetchMock = gateway({
			'/login': () => json(200, { mfa_required: 'email_otp' }),
			'/mfa/email/resend': () => json(200, { sent: true }),
		});
		await signInIntoCodeStep();
		codeForm().querySelector<HTMLButtonElement>('[data-login-code-resend]')?.click();
		await vi.waitFor(() => expect(codeError().textContent).toBe('A new code is on its way.'));
		expect(fetchMock.mock.calls.some(([url]) => String(url).endsWith('/mfa/email/resend'))).toBe(true);
		codeForm().querySelector<HTMLButtonElement>('[data-login-code-cancel]')?.click();
		expect(codeForm().hidden).toBe(true);
		expect(document.querySelector<HTMLElement>('form.portal-login')?.hidden).toBe(false);
		expect(codeInput().value).toBe('');
	});
});
