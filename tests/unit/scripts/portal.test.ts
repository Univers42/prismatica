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
		const fetchMock = vi.fn(async (url: string) => (String(url).endsWith('/login')
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
			expect(JSON.parse(String((call?.[1] as RequestInit).body))).toMatchObject({ email: 'ines@arlet.test' });
		} finally {
			vi.unstubAllGlobals();
		}
	});
});
