import { describe, it, expect, beforeEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('auth callback', () => {
	beforeEach(() => {
		vi.resetModules();
		vi.unstubAllGlobals();
		sessionStorage.clear();
		localStorage.clear();
		document.body.innerHTML = '<main data-auth-callback><p data-auth-status></p></main>';
	});

	it('cleans the URL before fetching', async () => {
		vi.stubEnv('PUBLIC_OAUTH_PROVIDERS', 'google');
		const { handleOAuthCallback } = await import('../../../src/scripts/auth-callback');
		const root = document.querySelector<HTMLElement>('[data-auth-callback]')!;
		const history = { state: null, replaceState: vi.fn() };
		const location = { pathname: '/auth/callback', search: '?code=abc', hash: '' };
		const fetchMock = vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200 }));
		vi.stubGlobal('fetch', fetchMock);
		sessionStorage.setItem('prismatica.oauth.pending', JSON.stringify({ verifier: 'v', provider: 'google', createdAt: Date.now() }));
		await handleOAuthCallback(root, { gatewayUrl: '/api/auth' } as never, location as never, history as never);
		expect(history.replaceState).toHaveBeenCalledWith(null, '', '/auth/callback');
	});

	it('reads the pending flow once and deletes it', async () => {
		vi.stubEnv('PUBLIC_OAUTH_PROVIDERS', 'google');
		const { handleOAuthCallback } = await import('../../../src/scripts/auth-callback');
		const root = document.querySelector<HTMLElement>('[data-auth-callback]')!;
		const history = { state: null, replaceState: vi.fn() };
		const location = { pathname: '/auth/callback', search: '?code=abc', hash: '' };
		const fetchMock = vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200 }));
		vi.stubGlobal('fetch', fetchMock);
		sessionStorage.setItem('prismatica.oauth.pending', JSON.stringify({ verifier: 'v', provider: 'google', createdAt: Date.now() }));
		await handleOAuthCallback(root, { gatewayUrl: '/api/auth' } as never, location as never, history as never);
		expect(sessionStorage.getItem('prismatica.oauth.pending')).toBeNull();
	});

	it('refuses a replay without fetching', async () => {
		vi.stubEnv('PUBLIC_OAUTH_PROVIDERS', 'google');
		const { handleOAuthCallback } = await import('../../../src/scripts/auth-callback');
		const root = document.querySelector<HTMLElement>('[data-auth-callback]')!;
		const history = { state: null, replaceState: vi.fn() };
		const location = { pathname: '/auth/callback', search: '?code=abc', hash: '' };
		const fetchMock = vi.fn();
		vi.stubGlobal('fetch', fetchMock);
		await handleOAuthCallback(root, { gatewayUrl: '/api/auth' } as never, location as never, history as never);
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it('refuses when the provider list is empty without fetching', async () => {
		vi.stubEnv('PUBLIC_OAUTH_PROVIDERS', '');
		const { handleOAuthCallback } = await import('../../../src/scripts/auth-callback');
		const root = document.querySelector<HTMLElement>('[data-auth-callback]')!;
		const history = { state: null, replaceState: vi.fn() };
		const location = { pathname: '/auth/callback', search: '?code=abc', hash: '' };
		const fetchMock = vi.fn();
		vi.stubGlobal('fetch', fetchMock);
		sessionStorage.setItem('prismatica.oauth.pending', JSON.stringify({ verifier: 'v', provider: 'google', createdAt: Date.now() }));
		await handleOAuthCallback(root, { gatewayUrl: '/api/auth' } as never, location as never, history as never);
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it('carries a no-referrer meta in callback.astro', () => {
		const source = readFileSync(resolve(process.cwd(), 'src/pages/auth/callback.astro'), 'utf8');
		expect(source).toMatch(/<meta[^>]*name="referrer"[^>]*content="no-referrer"[^>]*>/);
	});

	it('refuses a stale flow without fetching', async () => {
		vi.stubEnv('PUBLIC_OAUTH_PROVIDERS', 'google');
		const { handleOAuthCallback } = await import('../../../src/scripts/auth-callback');
		const root = document.querySelector<HTMLElement>('[data-auth-callback]')!;
		const history = { state: null, replaceState: vi.fn() };
		const location = { pathname: '/auth/callback', search: '?code=abc', hash: '' };
		const fetchMock = vi.fn();
		vi.stubGlobal('fetch', fetchMock);
		sessionStorage.setItem('prismatica.oauth.pending', JSON.stringify({ verifier: 'v', provider: 'google', createdAt: Date.now() - 11 * 60 * 1000 }));
		await handleOAuthCallback(root, { gatewayUrl: '/api/auth' } as never, location as never, history as never);
		expect(fetchMock).not.toHaveBeenCalled();
		expect(root.querySelector('[data-auth-status]')?.textContent).toContain('expired');
	});

	it('shows the collision message on 409 oauth_email_collision and does not navigate', async () => {
		vi.stubEnv('PUBLIC_OAUTH_PROVIDERS', 'google');
		const { handleOAuthCallback } = await import('../../../src/scripts/auth-callback');
		const root = document.querySelector<HTMLElement>('[data-auth-callback]')!;
		const history = { state: null, replaceState: vi.fn() };
		const location = { pathname: '/auth/callback', search: '?code=abc', hash: '' };
		const assign = vi.fn();
		(globalThis as unknown as { location: { assign: typeof assign } }).location.assign = assign;
		const fetchMock = vi.fn(async () => new Response(JSON.stringify({ error: 'oauth_email_collision' }), { status: 409 }));
		vi.stubGlobal('fetch', fetchMock);
		sessionStorage.setItem('prismatica.oauth.pending', JSON.stringify({ verifier: 'v', provider: 'google', createdAt: Date.now() }));
		await handleOAuthCallback(root, { gatewayUrl: '/api/auth' } as never, location as never, history as never);
		expect(root.querySelector('[data-auth-status]')?.textContent).toContain('already linked to another sign-in method');
		expect(assign).not.toHaveBeenCalled();
	});

	it('calls location.assign with a trusted redirectUrl', async () => {
		vi.stubEnv('PUBLIC_OAUTH_PROVIDERS', 'google');
		vi.useFakeTimers();
		const { handleOAuthCallback } = await import('../../../src/scripts/auth-callback');
		const root = document.querySelector<HTMLElement>('[data-auth-callback]')!;
		const history = { state: null, replaceState: vi.fn() };
		const location = { pathname: '/auth/callback', search: '?code=abc', hash: '' };
		const assign = vi.fn();
		(globalThis as unknown as { location: { assign: typeof assign } }).location.assign = assign;
		const fetchMock = vi.fn(async () => new Response(JSON.stringify({ ok: true, redirectUrl: 'http://localhost:4322/' }), { status: 200 }));
		vi.stubGlobal('fetch', fetchMock);
		sessionStorage.setItem('prismatica.oauth.pending', JSON.stringify({ verifier: 'v', provider: 'google', createdAt: Date.now() }));
		await handleOAuthCallback(root, { gatewayUrl: '/api/auth' } as never, location as never, history as never);
		vi.runAllTimers();
		expect(assign).toHaveBeenCalledWith('http://localhost:4322/');
		vi.useRealTimers();
	});

	it('blocks an untrusted redirectUrl without assigning', async () => {
		vi.stubEnv('PUBLIC_OAUTH_PROVIDERS', 'google');
		const { handleOAuthCallback } = await import('../../../src/scripts/auth-callback');
		const root = document.querySelector<HTMLElement>('[data-auth-callback]')!;
		const history = { state: null, replaceState: vi.fn() };
		const location = { pathname: '/auth/callback', search: '?code=abc', hash: '' };
		const assign = vi.fn();
		(globalThis as unknown as { location: { assign: typeof assign } }).location.assign = assign;
		const fetchMock = vi.fn(async () => new Response(JSON.stringify({ ok: true, redirectUrl: 'https://evil.example/x' }), { status: 200 }));
		vi.stubGlobal('fetch', fetchMock);
		sessionStorage.setItem('prismatica.oauth.pending', JSON.stringify({ verifier: 'v', provider: 'google', createdAt: Date.now() }));
		await handleOAuthCallback(root, { gatewayUrl: '/api/auth' } as never, location as never, history as never);
		expect(root.querySelector('[data-auth-status]')?.textContent).toContain('Workspace redirect blocked');
		expect(assign).not.toHaveBeenCalled();
	});

	it('maps provider_email_needs_verification to the verification message with 0 fetches', async () => {
		vi.stubEnv('PUBLIC_OAUTH_PROVIDERS', 'google');
		const { handleOAuthCallback } = await import('../../../src/scripts/auth-callback');
		const root = document.querySelector<HTMLElement>('[data-auth-callback]')!;
		const history = { state: null, replaceState: vi.fn() };
		const location = { pathname: '/auth/callback', search: '?error_code=provider_email_needs_verification', hash: '' };
		const fetchMock = vi.fn();
		vi.stubGlobal('fetch', fetchMock);
		sessionStorage.setItem('prismatica.oauth.pending', JSON.stringify({ verifier: 'v', provider: 'google', createdAt: Date.now() }));
		await handleOAuthCallback(root, { gatewayUrl: '/api/auth' } as never, location as never, history as never);
		expect(fetchMock).not.toHaveBeenCalled();
		expect(root.querySelector('[data-auth-status]')?.textContent).toContain('provider email needs verification');
	});

	it('proves replaceState happens before the pending-flow read and before fetch', async () => {
		vi.stubEnv('PUBLIC_OAUTH_PROVIDERS', 'google');
		const { handleOAuthCallback } = await import('../../../src/scripts/auth-callback');
		const root = document.querySelector<HTMLElement>('[data-auth-callback]')!;
		const order: string[] = [];
		const history = { state: null, replaceState: vi.fn(() => { order.push('replaceState'); }) };
		const location = { pathname: '/auth/callback', search: '?code=abc', hash: '' };
		const fetchMock = vi.fn(async () => { order.push('fetch'); return new Response(JSON.stringify({ ok: true }), { status: 200 }); });
		vi.stubGlobal('fetch', fetchMock);
		const originalGetItem = sessionStorage.getItem.bind(sessionStorage);
		Object.defineProperty(sessionStorage, 'getItem', {
			value: (key: string) => {
				if (key === 'prismatica.oauth.pending') order.push('readVerifier');
				return originalGetItem(key);
			},
			writable: true,
			configurable: true,
		});
		// seed through the real store first
		sessionStorage.setItem('prismatica.oauth.pending', JSON.stringify({ verifier: 'v', provider: 'google', createdAt: Date.now() }));
		await handleOAuthCallback(root, { gatewayUrl: '/api/auth' } as never, location as never, history as never);
		Object.defineProperty(sessionStorage, 'getItem', { value: originalGetItem, writable: true, configurable: true });
		expect(order.indexOf('replaceState')).toBeGreaterThanOrEqual(0);
		expect(order.indexOf('replaceState')).toBeLessThan(order.indexOf('readVerifier'));
		expect(order.indexOf('replaceState')).toBeLessThan(order.indexOf('fetch'));
	});

	it('keeps no auth token in storage after a successful flow', async () => {
		vi.stubEnv('PUBLIC_OAUTH_PROVIDERS', 'google');
		const { handleOAuthCallback } = await import('../../../src/scripts/auth-callback');
		const root = document.querySelector<HTMLElement>('[data-auth-callback]')!;
		const history = { state: null, replaceState: vi.fn() };
		const location = { pathname: '/auth/callback', search: '?code=abc', hash: '' };
		const fetchMock = vi.fn(async () => new Response(JSON.stringify({ ok: true, access_token: 'fake-access-token-123' }), { status: 200 }));
		vi.stubGlobal('fetch', fetchMock);
		sessionStorage.setItem('prismatica.oauth.pending', JSON.stringify({ verifier: 'v', provider: 'google', createdAt: Date.now() }));
		await handleOAuthCallback(root, { gatewayUrl: '/api/auth' } as never, location as never, history as never);
		const allValues = [...Object.keys(sessionStorage), ...Object.keys(localStorage)].map((k) => `${sessionStorage.getItem(k) ?? ''}${localStorage.getItem(k) ?? ''}`).join(' ');
		expect(allValues).not.toContain('fake-access-token-123');
		expect(sessionStorage.getItem('prismatica.oauth.pending')).toBeNull();
	});
});
