import { createHash } from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { OAUTH_PENDING_KEY, base64Url, bindPortalOAuth, createPkcePair, fetchOAuthProviders, oauthMarkup, startOAuthSignIn } from '../../../src/scripts/portal-oauth';

const ORIGIN = globalThis.location.origin;
const answer = (body: unknown, status = 200) => vi.fn(async () => new Response(JSON.stringify(body), { status }));

describe('fetchOAuthProviders', () => {
	it('returns the providers the gateway lists for this origin', async () => {
		const fetchMock = answer({ providers: ['google', 'github'], origin: ORIGIN });
		expect(await fetchOAuthProviders('/api/auth', ORIGIN, fetchMock)).toEqual(['google', 'github']);
		expect(fetchMock).toHaveBeenCalledWith('/api/auth/oauth/providers', expect.anything());
	});

	it('offers nothing on another origin, an unknown provider, an error status or a network failure', async () => {
		expect(await fetchOAuthProviders('/api/auth', ORIGIN, answer({ providers: ['google'], origin: 'https://other.test' }))).toEqual([]);
		expect(await fetchOAuthProviders('/api/auth', ORIGIN, answer({ providers: ['fortytwo', 'constructor'], origin: ORIGIN }))).toEqual([]);
		expect(await fetchOAuthProviders('/api/auth', ORIGIN, answer({ providers: ['google'], origin: ORIGIN }, 500))).toEqual([]);
		expect(await fetchOAuthProviders('/api/auth', ORIGIN, vi.fn(async () => Promise.reject(new Error('offline'))))).toEqual([]);
	});
});

describe('PKCE', () => {
	it('encodes base64url with no padding', () => {
		expect(base64Url(new Uint8Array([251, 255, 191]))).toBe('-_-_');
		expect(base64Url(new Uint8Array([1]))).toBe('AQ');
	});

	it('derives a 43-char S256 challenge from a 43-char verifier', async () => {
		const { verifier, challenge } = await createPkcePair();
		expect(verifier).toMatch(/^[A-Za-z0-9_-]{43}$/);
		expect(challenge).toBe(createHash('sha256').update(verifier).digest('base64url'));
	});

	it('stores the verifier and sends only the challenge to the gateway', async () => {
		const assign = vi.fn();
		await startOAuthSignIn('github', '/api/auth', sessionStorage, assign);
		const pending = JSON.parse(sessionStorage.getItem(OAUTH_PENDING_KEY)!);
		expect(pending.provider).toBe('github');
		const url = new URL(assign.mock.calls[0][0], ORIGIN);
		expect(url.pathname).toBe('/api/auth/oauth/authorize');
		expect(url.searchParams.get('provider')).toBe('github');
		expect(url.searchParams.get('code_challenge')).toBe(createHash('sha256').update(pending.verifier).digest('base64url'));
		expect(url.search).not.toContain(pending.verifier);
	});
});

describe('bindPortalOAuth', () => {
	afterEach(() => {
		document.body.innerHTML = '';
		vi.unstubAllGlobals();
	});

	function mount() {
		document.body.innerHTML = `<div id="portal">${oauthMarkup()}</div>`;
		return document.getElementById('portal')!;
	}

	it('stays hidden when grobase enables no provider', async () => {
		vi.stubGlobal('fetch', answer({ providers: [], origin: ORIGIN }));
		const portal = mount();
		await bindPortalOAuth(portal, '/api/auth');
		expect(portal.querySelector<HTMLElement>('[data-oauth-providers]')!.hidden).toBe(true);
		expect(portal.querySelectorAll('[data-oauth-provider]')).toHaveLength(0);
	});

	it('shows one logo button per enabled provider, named and described for assistive tech', async () => {
		vi.stubGlobal('fetch', answer({ providers: ['google', 'github'], origin: ORIGIN }));
		const portal = mount();
		await bindPortalOAuth(portal, '/api/auth');
		expect(portal.querySelector<HTMLElement>('[data-oauth-providers]')!.hidden).toBe(false);
		const buttons = [...portal.querySelectorAll<HTMLButtonElement>('[data-oauth-provider]')];
		expect(buttons.map((button) => button.getAttribute('aria-label'))).toEqual(['Continue with Google', 'Continue with GitHub']);
		for (const button of buttons) {
			expect(button.querySelector('svg[aria-hidden="true"] path')).not.toBeNull();
			const tooltip = document.getElementById(button.getAttribute('aria-describedby')!);
			expect(tooltip?.getAttribute('role')).toBe('tooltip');
			expect(button.contains(tooltip)).toBe(true);
		}
		expect(document.getElementById('portal-oauth-tooltip-google')!.textContent).toBe('Sign in or create your account with Google');
	});
});
