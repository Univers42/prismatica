// @vitest-environment node
import http from 'node:http';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { call, cookieNames, hits, hitsTo, listen, servers, startFakeKong, startGateway, stopAll, upstream, type Gateway } from './gateway-harness';

const SECRET = 'bridge-shared-secret-for-tests-0123456789';
const KEY = 'gateway-oauth-collision-test-key-0123456789abcdef';
const SITE_ORIGIN = 'https://localhost:4322';
const OAUTH = { origin: SITE_ORIGIN };
// grobase enables providers through GoTrue: these flags are the only switch the gateway reads.
const SAFE_SETTINGS = { mailer_autoconfirm: false, external: { google: true, github: false, email: true } };

type Identity = { provider: string; identity_data?: { email_verified?: boolean }; created_at?: string };

let gateway: Gateway;
let oauthGateway: Gateway;
let oauthUnreachableGateway: Gateway;
let otpGateway: Gateway;
let limiterGateway: Gateway;
let proxyGateway: Gateway;

let userEmail = 'ines@arlet.test';
let userConfirmedAt: string | null = '2026-10-01T00:00:00Z';
let userIdentities: unknown[] | null = [{ provider: 'email', identity_data: { email_verified: false }, created_at: '2026-10-01T00:00:00Z' }];
let userAmr: { method: string }[] = [{ method: 'password' }];
let bridgeStatus = 200;
let bridgeBody: Record<string, unknown> = { redirectUrl: 'https://app.example.test/home', access_token: 'bridge-at', token_type: 'bearer', refresh_token: 'leaked-refresh' };
const bridgeCalls: { body: string }[] = [];

// F8: GoTrue reports the email identity's own flag as false even on a confirmed account.
const EMAIL_IDENTITY: Identity = { provider: 'email', identity_data: { email_verified: false }, created_at: '2026-10-01T00:00:00Z' };
const GOOGLE_UNVERIFIED: Identity = { provider: 'google', identity_data: { email_verified: false }, created_at: '2026-10-02T00:00:00Z' };
const GOOGLE_VERIFIED: Identity = { provider: 'google', identity_data: { email_verified: true }, created_at: '2026-10-02T00:00:00Z' };

function fakeBridge() {
	return http.createServer((request, response) => {
		let body = '';
		request.on('data', (chunk) => (body += chunk));
		request.on('end', () => {
			bridgeCalls.push({ body });
			response.writeHead(bridgeStatus, { 'content-type': 'application/json' });
			response.end(JSON.stringify(bridgeBody));
		});
	});
}

beforeAll(async () => {
	await startFakeKong();
	const bridge = fakeBridge();
	const bridgePort = await listen(bridge);
	servers.push(bridge);
	const wiring = { OSIONOS_BRIDGE_URL: `http://127.0.0.1:${bridgePort}/s`, OSIONOS_BRIDGE_SHARED_SECRET: SECRET };
	gateway = await startGateway(wiring);
	oauthGateway = await startGateway(wiring);
	oauthUnreachableGateway = await startGateway({ ...wiring, OSIONOS_BRIDGE_URL: 'http://127.0.0.1:1/s' });
	otpGateway = await startGateway({ ...wiring, AUTH_LOGIN_EMAIL_OTP: 'true', AUTH_LINK_SIGNING_KEY: KEY });
	limiterGateway = await startGateway(wiring);
	proxyGateway = await startGateway({ ...wiring, AUTH_TRUSTED_PROXY_HOPS: '2' });
}, 30_000);

afterAll(stopAll);

beforeEach(async () => {
	// Let the previous test's fire-and-forget logout/audit land before the next test counts hits.
	await new Promise((done) => setTimeout(done, 100));
	hits.length = 0;
	bridgeCalls.length = 0;
	userEmail = 'ines@arlet.test';
	userConfirmedAt = '2026-10-01T00:00:00Z';
	userIdentities = [{ ...EMAIL_IDENTITY }];
	userAmr = [{ method: 'password' }];
	bridgeStatus = 200;
	bridgeBody = { redirectUrl: 'https://app.example.test/home', access_token: 'bridge-at', token_type: 'bearer', refresh_token: 'leaked-refresh' };
	upstream.userStatus = 200;
	upstream.amr = userAmr;
	upstream.pkce = { auth_code: 'code-1', code_verifier: 'verifier-1' };
	upstream.pkceTokenStatus = 200;
	upstream.pkceError = { error: 'invalid_grant', error_description: 'bad code' };
	upstream.settingsStatus = 200;
	upstream.settings = SAFE_SETTINGS;
	upstream.logoutStatus = 204;
});

function setUser(identities: unknown[] | null, confirmedAt: string | null = userConfirmedAt) {
	userIdentities = identities;
	userConfirmedAt = confirmedAt;
}

function userAnswer() {
	return {
		id: 'u1',
		email: userEmail,
		email_confirmed_at: userConfirmedAt,
		identities: userIdentities,
		user_metadata: { username: 'ines' },
		amr: userAmr,
	};
}

// The harness fake Kong recomposes /auth/v1/user from these fields on every request.
function syncUpstream() {
	upstream.user = userAnswer();
	upstream.amr = userAmr;
}

function audits(event: string, address = userEmail) {
	return hits.filter((hit) => hit.path.includes('auth_record_audit_event') && hit.body.includes(`"${event}"`) && hit.body.includes(address)).length;
}

function collisionBody() {
	return { error: 'oauth_email_collision', message: 'This email is already linked to another sign-in method.' };
}

function identityUnavailableBody() {
	return { error: 'oauth_identity_unavailable', message: 'Prismatica user identities are unavailable.' };
}

function exchangeFailedBody() {
	return { error: 'oauth_exchange_failed', message: 'OAuth sign-in failed.' };
}

function upstreamFailedBody() {
	return { error: 'oauth_upstream_failed', message: 'The sign-in service did not answer. Try again in a minute.' };
}

function unsafeConfigBody() {
	return { error: 'oauth_unsafe_config', message: 'Provider sign-in is not available right now.' };
}

const wait = (ms: number) => new Promise((done) => setTimeout(done, ms));

describe('collision guard', () => {
	it('refuses an unverified identity over a password account with 409 and logout', async () => {
		setUser([{ ...EMAIL_IDENTITY }, { ...GOOGLE_UNVERIFIED }]);
		syncUpstream();
		const result = await call(gateway, '/api/auth/osionos-session', { headers: { authorization: 'Bearer at' } });
		expect(result.status).toBe(409);
		expect(result.body).toEqual(collisionBody());
		expect(bridgeCalls).toHaveLength(0);
		await wait(50);
		expect(hitsTo('/auth/v1/logout?scope=local')).toHaveLength(1);
		expect(audits('osionos_bridge_refused', userEmail)).toBe(1);
	});

	it('keeps the response body byte-identical across addresses', async () => {
		setUser([{ ...EMAIL_IDENTITY }, { ...GOOGLE_UNVERIFIED }]);
		syncUpstream();
		const first = await call(gateway, '/api/auth/osionos-session', { headers: { authorization: 'Bearer at' }, ip: '10.1.1.1' });
		userEmail = 'other@arlet.test';
		syncUpstream();
		const second = await call(gateway, '/api/auth/osionos-session', { headers: { authorization: 'Bearer at' }, ip: '10.1.1.2' });
		expect(first.status).toBe(409);
		expect(second.status).toBe(409);
		expect(second.text).toBe(first.text);
	});

	it('allows a password-only user to mint', async () => {
		syncUpstream();
		const result = await call(gateway, '/api/auth/osionos-session', { headers: { authorization: 'Bearer at' } });
		expect(result.status).toBe(200);
		expect(bridgeCalls).toHaveLength(1);
	});

	it('amr (i): oauth amr with an unverified identity refuses', async () => {
		setUser([{ ...EMAIL_IDENTITY }, { ...GOOGLE_UNVERIFIED }]);
		syncUpstream();
		userAmr = [{ method: 'oauth' }];
		upstream.amr = userAmr;
		const result = await call(gateway, '/api/auth/osionos-session', { headers: { authorization: 'Bearer at' } });
		expect(result.status).toBe(409);
	});

	it('amr (ii): a password-only user mints', async () => {
		syncUpstream();
		const result = await call(gateway, '/api/auth/osionos-session', { headers: { authorization: 'Bearer at' } });
		expect(result.status).toBe(200);
	});

	it('amr (iii): a refreshed oauth token is still guarded', async () => {
		setUser([{ ...EMAIL_IDENTITY }, { ...GOOGLE_UNVERIFIED }]);
		syncUpstream();
		const first = await call(gateway, '/api/auth/osionos-session', { headers: { authorization: 'Bearer at' } });
		const second = await call(gateway, '/api/auth/osionos-session', { headers: { authorization: 'Bearer at' } });
		expect(first.status).toBe(409);
		expect(second.status).toBe(409);
	});

	it('allows verified-on-both-sides accounts', async () => {
		setUser([{ ...EMAIL_IDENTITY }, { ...GOOGLE_VERIFIED }]);
		syncUpstream();
		const result = await call(gateway, '/api/auth/osionos-session', { headers: { authorization: 'Bearer at' } });
		expect(result.status).toBe(200);
	});

	it('ignores the email identity flag (F8): false still allows a verified google identity', async () => {
		setUser([{ ...EMAIL_IDENTITY }, { ...GOOGLE_VERIFIED }], '2026-10-01T00:00:00Z');
		syncUpstream();
		const result = await call(gateway, '/api/auth/osionos-session', { headers: { authorization: 'Bearer at' } });
		expect(result.status).toBe(200);
		expect(bridgeCalls).toHaveLength(1);
	});

	it('refuses when the account was confirmed after the provider identity was created', async () => {
		setUser([{ ...EMAIL_IDENTITY }, { ...GOOGLE_VERIFIED }], '2026-10-03T00:00:00Z');
		syncUpstream();
		const result = await call(gateway, '/api/auth/osionos-session', { headers: { authorization: 'Bearer at' } });
		expect(result.status).toBe(409);
	});

	it('refuses 42 in a multi-identity account', async () => {
		setUser([{ ...EMAIL_IDENTITY }, { provider: 'custom:fortytwo', identity_data: { email_verified: true }, created_at: '2026-10-02T00:00:00Z' }]);
		syncUpstream();
		const result = await call(gateway, '/api/auth/osionos-session', { headers: { authorization: 'Bearer at' } });
		expect(result.status).toBe(409);
	});

	it('allows a single-identity 42 account', async () => {
		setUser([{ provider: 'custom:fortytwo', identity_data: { email_verified: false }, created_at: '2026-10-02T00:00:00Z' }]);
		syncUpstream();
		const result = await call(gateway, '/api/auth/osionos-session', { headers: { authorization: 'Bearer at' } });
		expect(result.status).toBe(200);
	});

	it('returns 422 when 42 provides no email', async () => {
		userEmail = '';
		setUser([{ provider: 'custom:fortytwo', identity_data: { email_verified: false }, created_at: '2026-10-02T00:00:00Z' }]);
		syncUpstream();
		const result = await call(gateway, '/api/auth/osionos-session', { headers: { authorization: 'Bearer at' } });
		expect(result.status).toBe(422);
	});

	it('treats custom:other with email_verified true as unverified', async () => {
		setUser([{ ...EMAIL_IDENTITY }, { provider: 'custom:other', identity_data: { email_verified: true }, created_at: '2026-10-02T00:00:00Z' }]);
		syncUpstream();
		const result = await call(gateway, '/api/auth/osionos-session', { headers: { authorization: 'Bearer at' } });
		expect(result.status).toBe(409);
	});

	it('returns 503 when identities are unreadable', async () => {
		setUser(null);
		syncUpstream();
		const result = await call(gateway, '/api/auth/osionos-session', { headers: { authorization: 'Bearer at' } });
		expect(result.status).toBe(503);
		expect(result.body).toEqual(identityUnavailableBody());
	});

	it('audits a failed logout and still answers 409', async () => {
		setUser([{ ...EMAIL_IDENTITY }, { ...GOOGLE_UNVERIFIED }]);
		syncUpstream();
		upstream.logoutStatus = 500;
		const result = await call(gateway, '/api/auth/osionos-session', { headers: { authorization: 'Bearer at' } });
		expect(result.status).toBe(409);
		await wait(100);
		expect(audits('osionos_bridge_refused_logout_failed', userEmail)).toBe(1);
	});

	it('refuses a password-amr token for a user with an unverified provider identity', async () => {
		setUser([{ ...EMAIL_IDENTITY }, { ...GOOGLE_UNVERIFIED }]);
		syncUpstream();
		userAmr = [{ method: 'password' }];
		upstream.amr = userAmr;
		const result = await call(gateway, '/api/auth/osionos-session', { headers: { authorization: 'Bearer at' } });
		expect(result.status).toBe(409);
		expect(result.body).toEqual(collisionBody());
	});

	it('fails closed on every malformed identity array', async () => {
		for (const identities of [[null], [{}], ['google'], []] as unknown[][]) {
			hits.length = 0;
			bridgeCalls.length = 0;
			setUser(identities);
			syncUpstream();
			const result = await call(gateway, '/api/auth/osionos-session', { headers: { authorization: 'Bearer at' } });
			expect(result.status).toBe(503);
			expect(result.body).toEqual(identityUnavailableBody());
			expect(bridgeCalls).toHaveLength(0);
			await wait(20);
			expect(hitsTo('/auth/v1/logout?scope=local')).toHaveLength(0);
		}
	});

	it('refuses when any provider identity has no usable created_at', async () => {
		setUser([
			{ ...EMAIL_IDENTITY },
			{ ...GOOGLE_VERIFIED },
			{ provider: 'github', identity_data: { email_verified: true } },
		]);
		syncUpstream();
		const missing = await call(gateway, '/api/auth/osionos-session', { headers: { authorization: 'Bearer at' } });
		expect(missing.status).toBe(409);

		hits.length = 0;
		setUser([
			{ ...EMAIL_IDENTITY },
			{ ...GOOGLE_VERIFIED },
			{ provider: 'github', identity_data: { email_verified: true }, created_at: 'not-a-date' },
		]);
		syncUpstream();
		const invalid = await call(gateway, '/api/auth/osionos-session', { headers: { authorization: 'Bearer at' } });
		expect(invalid.status).toBe(409);
	});
});

describe('osionos-session rate limit', () => {
	it('returns 429 with retry-after on the 31st call', async () => {
		syncUpstream();
		let response: Response | null = null;
		for (let i = 0; i < 31; i += 1) {
			response = await fetch(`${limiterGateway.base}/api/auth/osionos-session`, {
				method: 'POST',
				headers: { 'content-type': 'application/json', authorization: 'Bearer at', 'x-forwarded-for': '10.7.7.7' },
				body: JSON.stringify({}),
			});
		}
		expect(response?.status).toBe(429);
		expect(response?.headers.get('retry-after')).toBeTruthy();
	});
});

describe('oauth-session route', () => {
	it('answers 503 when grobase enables no provider, with no /token call', async () => {
		upstream.settings = { mailer_autoconfirm: false, external: { google: false, github: false } };
		const result = await call(oauthGateway, '/api/auth/oauth-session', { headers: OAUTH, body: { code: 'code-1', verifier: 'verifier-1' } });
		expect(result.status).toBe(503);
		expect(result.body).toEqual(unsafeConfigBody());
		expect(hitsTo('/auth/v1/token')).toHaveLength(0);
	});

	it('refuses in OTP mode before any GoTrue call', async () => {
		const result = await call(otpGateway, '/api/auth/oauth-session', { headers: OAUTH, body: { code: 'c', verifier: 'v' } });
		expect(result.status).toBe(409);
		expect(result.body.error).toBe('oauth_requires_password_login');
		expect(hitsTo('/auth/v1/settings')).toHaveLength(0);
		expect(hitsTo('/auth/v1/token')).toHaveLength(0);
	});

	it('exchanges once with the exact body, mints, sets one cookie, and returns the sanitized bridge answer', async () => {
		setUser([{ ...EMAIL_IDENTITY }]);
		syncUpstream();
		const result = await call(oauthGateway, '/api/auth/oauth-session', { headers: OAUTH, body: { code: 'code-1', verifier: 'verifier-1' } });
		expect(result.status).toBe(200);
		const tokens = hitsTo('/auth/v1/token?grant_type=pkce');
		expect(tokens).toHaveLength(1);
		expect(JSON.parse(tokens[0].body)).toEqual({ auth_code: 'code-1', code_verifier: 'verifier-1' });
		expect(result.body).toEqual({ redirectUrl: 'https://app.example.test/home', access_token: 'bridge-at', token_type: 'bearer' });
		expect(result.body.refresh_token).toBeUndefined();
		expect(result.cookies).toHaveLength(1);
		expect(cookieNames(result.cookies)).toEqual(['prismatica_refresh']);
		expect(bridgeCalls).toHaveLength(1);
	});

	it('maps a wrong verifier to a fixed 401 with no cookie and no mint', async () => {
		setUser([{ ...EMAIL_IDENTITY }]);
		syncUpstream();
		const result = await call(oauthGateway, '/api/auth/oauth-session', { headers: OAUTH, body: { code: 'code-1', verifier: 'wrong' } });
		expect(result.status).toBe(401);
		expect(result.body).toEqual(exchangeFailedBody());
		expect(result.cookies).toEqual([]);
		expect(bridgeCalls).toHaveLength(0);
	});

	it('maps a GoTrue 500 on /token to 502 and never reflects its body', async () => {
		setUser([{ ...EMAIL_IDENTITY }]);
		syncUpstream();
		upstream.pkceTokenStatus = 500;
		upstream.pkceError = { error_description: '<script>alert(1)</script> victim@example.com' };
		const result = await call(oauthGateway, '/api/auth/oauth-session', { headers: OAUTH, body: { code: 'code-1', verifier: 'verifier-1' } });
		expect(result.status).toBe(502);
		expect(result.body).toEqual(upstreamFailedBody());
		expect(result.text).not.toContain('<script>');
		expect(result.text).not.toContain('victim@example.com');
		expect(result.cookies).toEqual([]);
		expect(bridgeCalls).toHaveLength(0);
	});

	it('never reflects GoTrue text on a 4xx exchange failure', async () => {
		setUser([{ ...EMAIL_IDENTITY }]);
		syncUpstream();
		upstream.pkceTokenStatus = 400;
		upstream.pkceError = { error: 'invalid_grant', error_description: '<script>alert(1)</script> victim@example.com' };
		const result = await call(oauthGateway, '/api/auth/oauth-session', { headers: OAUTH, body: { code: 'code-1', verifier: 'verifier-1' } });
		expect(result.status).toBe(401);
		expect(result.body).toEqual(exchangeFailedBody());
		expect(result.text).not.toContain('<script>');
		expect(result.text).not.toContain('victim@example.com');
		expect(result.cookies).toEqual([]);
		expect(bridgeCalls).toHaveLength(0);
		const auditHit = hits.find((hit) => hit.path.includes('auth_record_audit_event') && hit.body.includes('oauth_exchange_failed'));
		expect(auditHit?.body).not.toContain('<script>');
		expect(auditHit?.body).not.toContain('victim@example.com');
	});

	it('never sets a cookie on any refusal', async () => {
		const noCookie = (result: { cookies: string[] }) => expect(result.cookies).toEqual([]);

		noCookie(await call(oauthGateway, '/api/auth/oauth-session', { body: { code: 'code-1', verifier: 'verifier-1' } }));
		noCookie(await call(oauthGateway, '/api/auth/oauth-session', { headers: { ...OAUTH, 'content-type': 'text/plain' }, body: { code: 'code-1', verifier: 'verifier-1' } }));
		noCookie(await call(otpGateway, '/api/auth/oauth-session', { headers: OAUTH, body: { code: 'code-1', verifier: 'verifier-1' } }));
		noCookie(await call(oauthGateway, '/api/auth/oauth-session', { headers: OAUTH, body: { code: 'code-1' } }));

		let limited: { status: number; cookies: string[] } | null = null;
		for (let i = 0; i < 31; i += 1) {
			limited = await call(oauthGateway, '/api/auth/oauth-session', { headers: OAUTH, ip: '10.8.8.9', body: { code: 'code-1', verifier: 'wrong' } });
		}
		expect(limited?.status).toBe(429);
		noCookie(limited!);

		setUser([{ ...EMAIL_IDENTITY }]);
		syncUpstream();
		upstream.settings = { mailer_autoconfirm: true };
		noCookie(await call(oauthGateway, '/api/auth/oauth-session', { headers: OAUTH, body: { code: 'code-1', verifier: 'verifier-1' } }));
		upstream.settings = SAFE_SETTINGS;

		noCookie(await call(oauthGateway, '/api/auth/oauth-session', { headers: OAUTH, body: { code: 'code-1', verifier: 'wrong' } }));

		setUser([{ ...EMAIL_IDENTITY }, { ...GOOGLE_UNVERIFIED }]);
		syncUpstream();
		noCookie(await call(oauthGateway, '/api/auth/oauth-session', { headers: OAUTH, body: { code: 'code-1', verifier: 'verifier-1' } }));

		setUser(null);
		syncUpstream();
		noCookie(await call(oauthGateway, '/api/auth/oauth-session', { headers: OAUTH, body: { code: 'code-1', verifier: 'verifier-1' } }));

		setUser([{ ...EMAIL_IDENTITY }]);
		syncUpstream();
		noCookie(await call(oauthUnreachableGateway, '/api/auth/oauth-session', { headers: OAUTH, body: { code: 'code-1', verifier: 'verifier-1' } }));
	});

	it('refuses a missing, foreign or non-JSON start before any GoTrue call', async () => {
		const missing = await call(oauthGateway, '/api/auth/oauth-session', { body: { code: 'code-1', verifier: 'verifier-1' } });
		expect(missing.status).toBe(403);
		expect(missing.body).toEqual({ error: 'oauth_origin_refused', message: 'Sign-in must start from the Prismatica site.' });
		expect(hits).toHaveLength(0);

		hits.length = 0;
		const evil = await call(oauthGateway, '/api/auth/oauth-session', { headers: { origin: 'https://evil.example' }, body: { code: 'code-1', verifier: 'verifier-1' } });
		expect(evil.status).toBe(403);
		expect(hits).toHaveLength(0);

		hits.length = 0;
		const text = await call(oauthGateway, '/api/auth/oauth-session', { headers: { ...OAUTH, 'content-type': 'text/plain' }, body: { code: 'code-1', verifier: 'verifier-1' } });
		expect(text.status).toBe(415);
		expect(text.body).toEqual({ error: 'unsupported_media_type', message: 'Send JSON.' });
		expect(hits).toHaveLength(0);
	});

	it('limits oauth-session per client IP at 30, with no 31st /token call', async () => {
		setUser([{ ...EMAIL_IDENTITY }]);
		syncUpstream();
		let last: { status: number } | null = null;
		for (let i = 0; i < 31; i += 1) {
			last = await call(oauthGateway, '/api/auth/oauth-session', { headers: OAUTH, ip: '10.8.8.8', body: { code: 'code-1', verifier: 'wrong' } });
		}
		expect(last?.status).toBe(429);
		expect(hitsTo('/auth/v1/token')).toHaveLength(30);
	});

	it('refuses unsafe autoconfirm settings: true, missing and a 500 each answer 503 with no /token', async () => {
		setUser([{ ...EMAIL_IDENTITY }]);
		syncUpstream();
		const cases: { settingsStatus: number; settings: Record<string, unknown> }[] = [
			{ settingsStatus: 200, settings: { mailer_autoconfirm: true } },
			{ settingsStatus: 200, settings: {} },
			{ settingsStatus: 500, settings: {} },
		];
		for (const testCase of cases) {
			hits.length = 0;
			upstream.settingsStatus = testCase.settingsStatus;
			upstream.settings = testCase.settings;
			const result = await call(oauthGateway, '/api/auth/oauth-session', { headers: OAUTH, body: { code: 'code-1', verifier: 'verifier-1' } });
			expect(result.status).toBe(503);
			expect(result.body).toEqual(unsafeConfigBody());
			expect(hitsTo('/auth/v1/token')).toHaveLength(0);
		}
	});

	it('revokes the exchanged session once when the bridge fails, and once on the 409 path', async () => {
		setUser([{ ...EMAIL_IDENTITY }]);
		syncUpstream();
		bridgeStatus = 500;
		const failed = await call(oauthGateway, '/api/auth/oauth-session', { headers: OAUTH, body: { code: 'code-1', verifier: 'verifier-1' } });
		expect(failed.status).toBe(502);
		expect(failed.cookies).toEqual([]);
		await wait(100);
		expect(hitsTo('/auth/v1/logout?scope=local')).toHaveLength(1);

		hits.length = 0;
		bridgeCalls.length = 0;
		bridgeStatus = 200;
		setUser([{ ...EMAIL_IDENTITY }, { ...GOOGLE_UNVERIFIED }]);
		syncUpstream();
		const refused = await call(oauthGateway, '/api/auth/oauth-session', { headers: OAUTH, body: { code: 'code-1', verifier: 'verifier-1' } });
		expect(refused.status).toBe(409);
		expect(bridgeCalls).toHaveLength(0);
		await wait(100);
		expect(hitsTo('/auth/v1/logout?scope=local')).toHaveLength(1);
	});

	it('sends no refresh cookie when the bridge answers 403 after a good exchange, and revokes', async () => {
		setUser([{ ...EMAIL_IDENTITY }]);
		syncUpstream();
		bridgeStatus = 403;
		const result = await call(oauthGateway, '/api/auth/oauth-session', { headers: OAUTH, body: { code: 'code-1', verifier: 'verifier-1' } });
		expect(result.status).toBe(403);
		expect(result.cookies).toEqual([]);
		await wait(100);
		expect(hitsTo('/auth/v1/logout?scope=local')).toHaveLength(1);
		bridgeStatus = 200;
	});

	it('keeps the existing osionos-session caller sanitized', async () => {
		setUser([{ ...EMAIL_IDENTITY }]);
		syncUpstream();
		const result = await call(gateway, '/api/auth/osionos-session', { headers: { authorization: 'Bearer at' } });
		expect(result.status).toBe(200);
		expect(result.body.refresh_token).toBeUndefined();
		expect(result.body.access_token).toBe('bridge-at');
	});

	it('buckets the app-exchange forwarded chain by the user address, not the bridge peer', async () => {
		setUser([{ ...EMAIL_IDENTITY }]);
		syncUpstream();
		const peer = '10.20.0.2';
		for (let i = 0; i < 30; i += 1) {
			const result = await call(proxyGateway, '/api/auth/osionos-session', { headers: { authorization: 'Bearer at', 'x-forwarded-for': `10.20.0.1, ${peer}` } });
			expect(result.status).toBe(200);
		}
		const other = await call(proxyGateway, '/api/auth/osionos-session', { headers: { authorization: 'Bearer at', 'x-forwarded-for': `10.20.0.3, ${peer}` } });
		expect(other.status).not.toBe(429);
		expect(other.status).toBe(200);
	});

	it('never schedules the login alert on a refusal', async () => {
		setUser([{ ...EMAIL_IDENTITY }, { ...GOOGLE_UNVERIFIED }]);
		syncUpstream();
		const mailBefore = hitsTo('/email/v1/send').length;
		const alertsBefore = audits('login_alert_sent', userEmail);
		const result = await call(oauthGateway, '/api/auth/oauth-session', { headers: OAUTH, body: { code: 'code-1', verifier: 'verifier-1' } });
		expect(result.status).toBe(409);
		await wait(300);
		expect(hitsTo('/email/v1/send')).toHaveLength(mailBefore);
		expect(audits('login_alert_sent', userEmail)).toBe(alertsBefore);
	});
});
