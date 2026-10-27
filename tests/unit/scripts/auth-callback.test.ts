import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { completeOAuthCallback, takePendingFlow } from '../../../src/scripts/auth-callback';
import { OAUTH_PENDING_KEY } from '../../../src/scripts/portal-oauth';

const APP = `${globalThis.location.origin}/workspace`;

function history() {
	return { state: null, replaceState: vi.fn() };
}

function startFlow(createdAt = Date.now()) {
	sessionStorage.setItem(OAUTH_PENDING_KEY, JSON.stringify({ verifier: 'verifier-1', provider: 'google', createdAt }));
}

function gateway(body: unknown, status = 200) {
	return vi.fn<typeof fetch>(async () => new Response(JSON.stringify(body), { status }));
}

const callback = (search: string) => ({ pathname: '/auth/callback', search });

describe('completeOAuthCallback', () => {
	beforeEach(() => sessionStorage.clear());
	afterEach(() => sessionStorage.clear());

	it('exchanges the code with the stored verifier and redirects to the app', async () => {
		startFlow();
		const fetchMock = gateway({ redirectUrl: APP });
		const outcome = await completeOAuthCallback('/api/auth', callback('?code=code-1'), history(), sessionStorage, fetchMock);
		expect(outcome).toEqual({ kind: 'redirect', url: APP });
		const [url, init] = fetchMock.mock.calls[0];
		expect(url).toBe('/api/auth/oauth-session');
		expect(JSON.parse(String(init?.body))).toEqual({ code: 'code-1', verifier: 'verifier-1' });
		expect(init?.credentials).toBe('include');
	});

	it('strips the query before any request, on every path', async () => {
		for (const search of ['?code=code-1', '?error=access_denied', '']) {
			const browserHistory = history();
			await completeOAuthCallback('/api/auth', callback(search), browserHistory, sessionStorage, gateway({}));
			expect(browserHistory.replaceState).toHaveBeenCalledWith(null, '', '/auth/callback');
		}
	});

	it('uses a flow once: a replayed callback finds no verifier', async () => {
		startFlow();
		await completeOAuthCallback('/api/auth', callback('?code=code-1'), history(), sessionStorage, gateway({ redirectUrl: APP }));
		const fetchMock = gateway({ redirectUrl: APP });
		const replay = await completeOAuthCallback('/api/auth', callback('?code=code-1'), history(), sessionStorage, fetchMock);
		expect(replay.kind).toBe('error');
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it('maps provider and gateway refusals to fixed text', async () => {
		const denied = await completeOAuthCallback('/api/auth', callback('?error=access_denied&error_description=<b>x</b>'), history(), sessionStorage, gateway({}));
		expect(denied).toEqual({ kind: 'error', message: 'Sign-in was cancelled at the provider.' });
		startFlow();
		const collision = await completeOAuthCallback('/api/auth', callback('?code=code-1'), history(), sessionStorage, gateway({ error: 'oauth_email_collision', message: '<b>raw</b>' }, 409));
		expect(collision).toEqual({ kind: 'error', message: 'This email already has a Prismatica account. Sign in with your password instead.' });
	});

	it('blocks a redirect to an unknown origin', async () => {
		startFlow();
		const outcome = await completeOAuthCallback('/api/auth', callback('?code=code-1'), history(), sessionStorage, gateway({ redirectUrl: 'https://evil.example/' }));
		expect(outcome.kind).toBe('error');
	});

	it('reports an unreachable gateway', async () => {
		startFlow();
		const outcome = await completeOAuthCallback('/api/auth', callback('?code=code-1'), history(), sessionStorage, vi.fn(async () => Promise.reject(new Error('offline'))));
		expect(outcome).toEqual({ kind: 'error', message: 'The sign-in service did not answer. Try again in a minute.' });
	});
});

describe('takePendingFlow', () => {
	it('refuses a flow older than ten minutes and a malformed entry', () => {
		const now = Date.now();
		startFlow(now - 10 * 60 * 1000 - 1);
		expect(takePendingFlow(sessionStorage, now)).toBeNull();
		sessionStorage.setItem(OAUTH_PENDING_KEY, '{not json');
		expect(takePendingFlow(sessionStorage, now)).toBeNull();
		expect(sessionStorage.getItem(OAUTH_PENDING_KEY)).toBeNull();
	});
});
