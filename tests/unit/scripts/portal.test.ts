import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { openPortal, closePortal, readTurnstileToken } from '../../../src/scripts/portal';
import { bindPasswordToggles } from '../../../src/scripts/password-toggle';

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

	it('offers the email sign-in code in sign-in mode only, with its step form present', () => {
		openPortal('connect');
		const trigger = document.querySelector<HTMLElement>('[data-portal-action="email-code"]');
		expect(trigger?.hidden).toBe(false);
		expect(document.querySelector('form.portal-signin-code')).not.toBeNull();
		document.querySelector<HTMLElement>('[data-auth-switch="register"]')?.click();
		expect(trigger?.hidden).toBe(true);
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

	it('sends no token outside DEV when no Turnstile site key is set', () => {
		openPortal('start');
		const portal = document.querySelector<HTMLElement>('#portal');
		if (!portal) throw new Error('no portal');
		const input = document.querySelector<HTMLInputElement>('[data-turnstile-token]');
		if (input) input.value = '';
		vi.stubEnv('DEV', false);
		try {
			expect(readTurnstileToken(portal)).toBe('');
		} finally {
			vi.unstubAllEnvs();
		}
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

describe('account mail from the portal (POST /api/auth/recover and /resend-verification)', () => {
	const ACCEPTED = 'If an account can receive mail at that address, a message is on its way. Check your inbox.';
	let fetchMock: ReturnType<typeof vi.fn>;

	beforeEach(() => {
		document.body.innerHTML = '';
		fetchMock = vi.fn(async () => new Response(JSON.stringify({ message: ACCEPTED }), { status: 202 }));
		vi.stubGlobal('fetch', fetchMock);
	});

	afterEach(() => {
		closePortal();
		vi.unstubAllGlobals();
		document.body.innerHTML = '';
	});

	const passwordHidden = () => Boolean(document.querySelector('#portal-password')?.closest('[hidden]'));
	const submitLabel = () => document.querySelector('[data-auth-submit]')?.textContent?.trim();

	async function requestFor(email: string) {
		const field = document.querySelector<HTMLInputElement>('#portal-email')!;
		field.value = email;
		field.dispatchEvent(new Event('input'));
		document.querySelector('form.portal-login')!.dispatchEvent(new Event('submit', { cancelable: true }));
		await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());
		const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
		return { url, body: JSON.parse(String(init.body)) };
	}

	it('"Forgot password?" turns sign-in into a reset request that posts the email to /recover', async () => {
		openPortal('connect');
		document.querySelector<HTMLButtonElement>('[data-portal-action="forgot-password"]')!.click();
		expect(passwordHidden()).toBe(true);
		expect(submitLabel()).toBe('Send reset link');
		const sent = await requestFor('ines@arlet.example.com');
		expect(sent.url).toMatch(/\/recover$/);
		expect(sent.body).toEqual({ email: 'ines@arlet.example.com', turnstileToken: 'localhost-turnstile-token' });
	});

	it('opens straight into a new confirmation link request that posts to /resend-verification', async () => {
		openPortal('resend');
		expect(passwordHidden()).toBe(true);
		expect(submitLabel()).toBe('Send a new link');
		const sent = await requestFor('ines@arlet.example.com');
		expect(sent.url).toMatch(/\/resend-verification$/);
	});

	it('shows the gateway answer, which reads the same whether or not the account exists', async () => {
		openPortal('recovery');
		await requestFor('nobody@arlet.example.com');
		await vi.waitFor(() => expect(document.querySelector('[data-auth-note]')?.textContent).toBe(ACCEPTED));
	});

	it('a sign-in refused for an unconfirmed email turns into the new-link form, email kept', async () => {
		fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ message: 'Email not confirmed' }), { status: 400 }));
		openPortal('connect');
		const email = document.querySelector<HTMLInputElement>('#portal-email')!;
		const password = document.querySelector<HTMLInputElement>('#portal-password')!;
		email.value = 'ines@arlet.example.com';
		password.value = 'Arlet!2026x';
		document.querySelector('form.portal-login')!.dispatchEvent(new Event('submit', { cancelable: true }));
		await vi.waitFor(() => expect(submitLabel()).toBe('Send a new link'));
		expect(passwordHidden()).toBe(true);
		expect(email.value).toBe('ines@arlet.example.com');
	});

	it('"Back to sign in" brings the password field back', () => {
		openPortal('recovery');
		document.querySelector<HTMLButtonElement>('.portal-mail-only[data-auth-switch="login"]')!.click();
		expect(passwordHidden()).toBe(false);
		expect(submitLabel()).toBe('Sign in');
	});
});

describe('portal OAuth buttons', () => {
	beforeEach(() => {
		vi.resetModules();
		vi.unstubAllGlobals();
		document.body.innerHTML = '';
	});

	afterEach(() => {
		document.body.innerHTML = '';
	});

	it('renders no OAuth buttons when PUBLIC_OAUTH_PROVIDERS is unset', async () => {
		vi.stubEnv('PUBLIC_OAUTH_PROVIDERS', '');
		const { openPortal, closePortal } = await import('../../../src/scripts/portal');
		openPortal('connect');
		expect(document.querySelectorAll('[data-oauth-provider]').length).toBe(0);
		closePortal();
	});

	it('renders one button per enabled provider', async () => {
		vi.stubEnv('PUBLIC_OAUTH_PROVIDERS', 'google,github');
		const { openPortal, closePortal } = await import('../../../src/scripts/portal');
		openPortal('connect');
		const providers = Array.from(document.querySelectorAll<HTMLElement>('[data-oauth-provider]')).map((el) => el.dataset.oauthProvider);
		expect(providers).toEqual(['google', 'github']);
		closePortal();
	});

	it('ignores unknown providers', async () => {
		vi.stubEnv('PUBLIC_OAUTH_PROVIDERS', 'google,apple');
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
		const { openPortal, closePortal } = await import('../../../src/scripts/portal');
		openPortal('connect');
		const providers = Array.from(document.querySelectorAll<HTMLElement>('[data-oauth-provider]')).map((el) => el.dataset.oauthProvider);
		expect(providers).toEqual(['google']);
		expect(warn).toHaveBeenCalled();
		closePortal();
		warn.mockRestore();
	});

	it('hides OAuth buttons in register mode', async () => {
		vi.stubEnv('PUBLIC_OAUTH_PROVIDERS', 'google');
		const { openPortal, closePortal } = await import('../../../src/scripts/portal');
		openPortal('start');
		const container = document.querySelector<HTMLElement>('[data-oauth-container]');
		expect(container?.hidden).toBe(true);
		closePortal();
	});
});

describe('portal handleOAuthSignIn', () => {
	async function sha256Base64Url(value: string): Promise<string> {
		const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
		const bytes = new Uint8Array(digest);
		let binary = '';
		for (const byte of bytes) binary += String.fromCharCode(byte);
		return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
	}

	beforeEach(() => {
		vi.resetModules();
		vi.unstubAllGlobals();
		sessionStorage.clear();
		document.body.innerHTML = '';
	});

	afterEach(() => {
		document.body.innerHTML = '';
		sessionStorage.clear();
	});

	it('assigns a PKCE authorize URL for each enabled provider', async () => {
		vi.stubEnv('PUBLIC_OAUTH_PROVIDERS', 'google,github,fortytwo');
		const portalMod = await import('../../../src/scripts/portal');
		const { openPortal, closePortal } = portalMod;
		openPortal('connect');
		for (const [provider, expectedProvider, scopes] of [
			['google', 'google', undefined],
			['github', 'github', 'read:user user:email'],
			['fortytwo', 'custom:fortytwo', 'public'],
		] as const) {
			sessionStorage.clear();
			const assign = vi.fn();
			(globalThis as unknown as { location: { assign: typeof assign; origin: string } }).location.assign = assign;
			const button = document.querySelector<HTMLButtonElement>(`[data-oauth-provider="${provider}"]`);
			expect(button).not.toBeNull();
			button?.click();
			await vi.waitFor(() => expect(assign).toHaveBeenCalled());
			const url = new URL(assign.mock.calls[0][0] as string);
			expect(url.pathname.endsWith('/auth/v1/authorize')).toBe(true);
			expect(url.searchParams.get('provider')).toBe(expectedProvider);
			expect(url.searchParams.get('redirect_to')).toBe(`${window.location.origin}/auth/callback`);
			expect(url.searchParams.get('code_challenge_method')).toBe('s256');
			const pendingRaw = sessionStorage.getItem('prismatica.oauth.pending');
			expect(pendingRaw).not.toBeNull();
			const pending = JSON.parse(pendingRaw as string) as { verifier: string; provider: string };
			expect(pending.verifier).toHaveLength(43);
			expect(pending.provider).toBe(provider);
			expect(url.href).not.toContain(pending.verifier);
			expect(url.searchParams.get('code_challenge')).toBe(await sha256Base64Url(pending.verifier));
			if (scopes) expect(url.searchParams.get('scopes')).toBe(scopes);
			else expect(url.searchParams.get('scopes')).toBeNull();
		}
		closePortal();
	});

	it('does nothing for a disabled provider', async () => {
		vi.stubEnv('PUBLIC_OAUTH_PROVIDERS', 'google');
		const { handleOAuthSignIn } = await import('../../../src/scripts/portal');
		const assign = vi.fn();
		(globalThis as unknown as { location: { assign: typeof assign } }).location.assign = assign;
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
		await handleOAuthSignIn('github' as never);
		expect(assign).not.toHaveBeenCalled();
		expect(sessionStorage.getItem('prismatica.oauth.pending')).toBeNull();
		warn.mockRestore();
	});
});

