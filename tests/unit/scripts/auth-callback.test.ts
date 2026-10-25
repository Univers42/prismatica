import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('auth callback', () => {
	beforeEach(() => {
		vi.resetModules();
		vi.unstubAllGlobals();
		sessionStorage.clear();
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
		await handleOAuthCallback(root, { gatewayUrl: '/api/auth' }, location as any, history as any);
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
		await handleOAuthCallback(root, { gatewayUrl: '/api/auth' }, location as any, history as any);
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
		await handleOAuthCallback(root, { gatewayUrl: '/api/auth' }, location as any, history as any);
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
		await handleOAuthCallback(root, { gatewayUrl: '/api/auth' }, location as any, history as any);
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it('injects a no-referrer meta', async () => {
		vi.stubEnv('PUBLIC_OAUTH_PROVIDERS', 'google');
		const { handleOAuthCallback } = await import('../../../src/scripts/auth-callback');
		const root = document.querySelector<HTMLElement>('[data-auth-callback]')!;
		const history = { state: null, replaceState: vi.fn() };
		const location = { pathname: '/auth/callback', search: '?code=abc', hash: '' };
		const fetchMock = vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200 }));
		vi.stubGlobal('fetch', fetchMock);
		sessionStorage.setItem('prismatica.oauth.pending', JSON.stringify({ verifier: 'v', provider: 'google', createdAt: Date.now() }));
		await handleOAuthCallback(root, { gatewayUrl: '/api/auth' }, location as any, history as any);
		expect(document.querySelector('meta[name="referrer"]')?.getAttribute('content')).toBe('no-referrer');
	});
});
