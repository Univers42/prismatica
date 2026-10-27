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
		expect(outcome).toEqual({ kind: 'redirect', url: APP, credentialReset: false, provider: 'google' });
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

	it('reports a sign-in that removed the account password, and maps the link refusals', async () => {
		startFlow();
		const reset = await completeOAuthCallback('/api/auth', callback('?code=code-1'), history(), sessionStorage, gateway({ redirectUrl: APP, credential_reset: true }));
		expect(reset).toEqual({ kind: 'redirect', url: APP, credentialReset: true, provider: 'google' });
		const problems: Record<string, string> = { oauth_mfa_account: 'mfa_account', oauth_link_busy: 'service_down', oauth_link_unavailable: 'service_down', oauth_link_reset_failed: 'link_unfinished' };
		for (const [error, problem] of Object.entries(problems)) {
			startFlow();
			const outcome = await completeOAuthCallback('/api/auth', callback('?code=code-1'), history(), sessionStorage, gateway({ error }, 409));
			expect(outcome, error).toMatchObject({ kind: 'error', problem, code: error });
		}
	});

	it('maps provider and gateway refusals to a problem and a plain reference code', async () => {
		startFlow();
		const denied = await completeOAuthCallback('/api/auth', callback('?error=access_denied&error_code=&error_description=<b>x</b>'), history(), sessionStorage, gateway({}));
		expect(denied).toEqual({ kind: 'error', problem: 'cancelled', code: 'access_denied', provider: 'google' });
		startFlow();
		const collision = await completeOAuthCallback('/api/auth', callback('?code=code-1'), history(), sessionStorage, gateway({ error: 'oauth_email_collision', message: '<b>raw</b>' }, 409));
		expect(collision).toEqual({ kind: 'error', problem: 'email_in_use', code: 'oauth_email_collision', provider: 'google' });
	});

	it('never echoes a hostile code and falls back to a generic failure', async () => {
		const hostile = await completeOAuthCallback('/api/auth', callback('?error=<img src=x>'), history(), sessionStorage, gateway({}));
		expect(hostile).toEqual({ kind: 'error', problem: 'failed', code: 'unknown_error', provider: null });
		startFlow();
		const unlisted = await completeOAuthCallback('/api/auth', callback('?code=code-1'), history(), sessionStorage, gateway({}, 500));
		expect(unlisted).toMatchObject({ problem: 'failed', code: 'http_500' });
	});

	it('reports a missing or used flow as expired', async () => {
		const outcome = await completeOAuthCallback('/api/auth', callback('?code=code-1'), history(), sessionStorage, gateway({}));
		expect(outcome).toEqual({ kind: 'error', problem: 'expired', code: 'oauth_flow_missing', provider: null });
		const reloaded = await completeOAuthCallback('/api/auth', callback(''), history(), sessionStorage, gateway({}));
		expect(reloaded).toEqual({ kind: 'error', problem: 'expired', code: 'oauth_flow_missing', provider: null });
	});

	it('blocks a redirect to an unknown origin', async () => {
		startFlow();
		const outcome = await completeOAuthCallback('/api/auth', callback('?code=code-1'), history(), sessionStorage, gateway({ redirectUrl: 'https://evil.example/' }));
		expect(outcome).toMatchObject({ kind: 'error', problem: 'redirect_blocked' });
	});

	it('reports an unreachable gateway', async () => {
		startFlow();
		const outcome = await completeOAuthCallback('/api/auth', callback('?code=code-1'), history(), sessionStorage, vi.fn(async () => Promise.reject(new Error('offline'))));
		expect(outcome).toEqual({ kind: 'error', problem: 'service_down', code: 'oauth_network_failed', provider: 'google' });
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
