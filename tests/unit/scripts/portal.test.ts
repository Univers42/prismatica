import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { openPortal, closePortal, bindPasswordToggles, readTurnstileToken } from '../../../src/scripts/portal';

describe('Portal Script Module', () => {
	beforeEach(() => {
		document.body.innerHTML = '';
	});

	afterEach(() => {
		closePortal();
		document.body.innerHTML = '';
	});

	it('binds password toggles only inside the given root, once per call', () => {
		const field = (id: string): string => `<div class="field" id="${id}"><input type="password" /><button type="button" data-password-toggle></button></div>`;
		document.body.innerHTML = field('a') + field('b');
		const [a, b] = ['a', 'b'].map((id) => document.getElementById(id)!);
		bindPasswordToggles(a);
		bindPasswordToggles(b);
		a.querySelector('button')!.click();
		b.querySelector('button')!.click();
		// One listener each: a second binding of the same toggle would flip the field back.
		expect(a.querySelector('input')!.type).toBe('text');
		expect(b.querySelector('input')!.type).toBe('text');
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
});