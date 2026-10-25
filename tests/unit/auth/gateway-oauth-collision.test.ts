// @vitest-environment node
import http from 'node:http';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { call, hits, hitsTo, listen, servers, startFakeKong, startGateway, stopAll, type Gateway } from './gateway-harness';

const SECRET = 'bridge-shared-secret-for-tests-0123456789';
const KEY = 'gateway-oauth-collision-test-key-0123456789abcdef';

type Id = { provider: string; identity_data?: { email_verified?: boolean }; created_at?: string };

let gateway: Gateway;
let oauthGateway: Gateway;
let emptyGateway: Gateway;
let otpGateway: Gateway;
let limiterGateway: Gateway;

let userEmail = 'ines@arlet.test';
let userConfirmedAt: string | null = '2026-10-01T00:00:00Z';
let userIdentities: Id[] | null = [{ provider: 'email', identity_data: { email_verified: true }, created_at: '2026-10-01T00:00:00Z' }];
let logoutStatus = 204;
let pkceStatus = 200;
const bridgeCalls: { body: string }[] = [];

function fakeBridge() {
	return http.createServer((request, response) => {
		let body = '';
		request.on('data', (chunk) => (body += chunk));
		request.on('end', () => {
			bridgeCalls.push({ body });
			response.writeHead(200, { 'content-type': 'application/json' });
			response.end(JSON.stringify({ redirectUrl: 'https://app.example.test/home', refresh_token: 'leaked-refresh' }));
		});
	});
}

function userKong() {
	return http.createServer((request, response) => {
		let body = '';
		request.on('data', (chunk) => (body += chunk));
		request.on('end', () => {
			hits.push({ method: request.method ?? '', path: request.url ?? '', body, apikey: request.headers.apikey as string | undefined });
			const path = request.url ?? '';
			if (path.startsWith('/auth/v1/user')) {
				response.writeHead(200, { 'content-type': 'application/json' });
				response.end(JSON.stringify({ id: 'u1', email: userEmail, email_confirmed_at: userConfirmedAt, amr: [{ method: 'oauth' }], identities: userIdentities, user_metadata: { username: 'ines' } }));
				return;
			}
			if (path.startsWith('/auth/v1/token?grant_type=pkce')) {
				response.writeHead(pkceStatus, { 'content-type': 'application/json' });
				response.end(JSON.stringify(pkceStatus === 200 ? { access_token: 'oauth-at', refresh_token: 'oauth-rt', token_type: 'bearer', expires_in: 3600, user: { id: 'u1', email: userEmail } } : { error: 'invalid_grant', error_description: 'bad code' }));
				return;
			}
			if (path.startsWith('/auth/v1/logout')) {
				response.writeHead(logoutStatus, { 'content-type': 'application/json' });
				response.end(JSON.stringify({}));
				return;
			}
			if (path.startsWith('/rest/v1/') || path.startsWith('/auth/v1/')) {
				response.writeHead(200, { 'content-type': 'application/json' });
				response.end(JSON.stringify([]));
				return;
			}
			response.writeHead(200, { 'content-type': 'application/json' });
			response.end('{}');
		});
	});
}

beforeAll(async () => {
	await startFakeKong();
	const bridge = fakeBridge();
	const kong = userKong();
	const [bridgePort, kongPort] = [await listen(bridge), await listen(kong)];
	servers.push(bridge, kong);
	const wiring = { PUBLIC_BAAS_URL: `http://127.0.0.1:${kongPort}`, OSIONOS_BRIDGE_URL: `http://127.0.0.1:${bridgePort}/s`, OSIONOS_BRIDGE_SHARED_SECRET: SECRET };
	gateway = await startGateway(wiring);
	oauthGateway = await startGateway({ ...wiring, PUBLIC_OAUTH_PROVIDERS: 'google' });
	emptyGateway = await startGateway({ ...wiring, PUBLIC_OAUTH_PROVIDERS: '' });
	otpGateway = await startGateway({ ...wiring, PUBLIC_OAUTH_PROVIDERS: 'google', AUTH_LOGIN_EMAIL_OTP: 'true', AUTH_LINK_SIGNING_KEY: KEY });
	limiterGateway = await startGateway(wiring);
}, 30_000);

afterAll(stopAll);

beforeEach(() => {
	hits.length = 0;
	bridgeCalls.length = 0;
	userEmail = 'ines@arlet.test';
	userConfirmedAt = '2026-10-01T00:00:00Z';
	userIdentities = [{ provider: 'email', identity_data: { email_verified: true }, created_at: '2026-10-01T00:00:00Z' }];
	logoutStatus = 204;
	pkceStatus = 200;
});

function audits(event: string, address = userEmail) {
	return hits.filter((hit) => hit.path.includes('auth_record_audit_event') && hit.body.includes(`"${event}"`) && hit.body.includes(address)).length;
}

function collisionBody() {
	return { error: 'oauth_email_collision', message: 'This email is already linked to another sign-in method.' };
}

describe('collision guard', () => {
	it('refuses an unverified identity over a password account with 409 and logout', async () => {
		userIdentities = [
			{ provider: 'email', identity_data: { email_verified: true }, created_at: '2026-10-01T00:00:00Z' },
			{ provider: 'google', identity_data: { email_verified: false }, created_at: '2026-10-02T00:00:00Z' },
		];
		userConfirmedAt = '2026-10-01T00:00:00Z';
		const result = await call(gateway, '/api/auth/osionos-session', { headers: { authorization: 'Bearer at' } });
		expect(result.status).toBe(409);
		expect(result.body).toEqual(collisionBody());
		expect(bridgeCalls).toHaveLength(0);
		await new Promise((done) => setTimeout(done, 50));
		expect(hitsTo('/auth/v1/logout?scope=local')).toHaveLength(1);
		expect(audits('osionos_bridge_refused', userEmail)).toBe(1);
	});

	it('keeps the response body byte-identical across addresses', async () => {
		userIdentities = [
			{ provider: 'email', identity_data: { email_verified: true }, created_at: '2026-10-01T00:00:00Z' },
			{ provider: 'google', identity_data: { email_verified: false }, created_at: '2026-10-02T00:00:00Z' },
		];
		const first = await call(gateway, '/api/auth/osionos-session', { headers: { authorization: 'Bearer at' }, ip: '10.1.1.1' });
		userEmail = 'other@arlet.test';
		const second = await call(gateway, '/api/auth/osionos-session', { headers: { authorization: 'Bearer at' }, ip: '10.1.1.2' });
		expect(first.status).toBe(409);
		expect(second.status).toBe(409);
		expect(second.text).toBe(first.text);
	});

	it('allows a password-only user to mint', async () => {
		const result = await call(gateway, '/api/auth/osionos-session', { headers: { authorization: 'Bearer at' } });
		expect(result.status).toBe(200);
		expect(bridgeCalls).toHaveLength(1);
	});

	it('amr (i): oauth amr with an unverified identity refuses', async () => {
		userIdentities = [
			{ provider: 'email', identity_data: { email_verified: true }, created_at: '2026-10-01T00:00:00Z' },
			{ provider: 'google', identity_data: { email_verified: false }, created_at: '2026-10-02T00:00:00Z' },
		];
		const result = await call(gateway, '/api/auth/osionos-session', { headers: { authorization: 'Bearer at' } });
		expect(result.status).toBe(409);
	});

	it('amr (ii): a password-only user mints', async () => {
		const result = await call(gateway, '/api/auth/osionos-session', { headers: { authorization: 'Bearer at' } });
		expect(result.status).toBe(200);
	});

	it('amr (iii): a refreshed oauth token is still guarded', async () => {
		userIdentities = [
			{ provider: 'email', identity_data: { email_verified: true }, created_at: '2026-10-01T00:00:00Z' },
			{ provider: 'google', identity_data: { email_verified: false }, created_at: '2026-10-02T00:00:00Z' },
		];
		const first = await call(gateway, '/api/auth/osionos-session', { headers: { authorization: 'Bearer at' } });
		const second = await call(gateway, '/api/auth/osionos-session', { headers: { authorization: 'Bearer at' } });
		expect(first.status).toBe(409);
		expect(second.status).toBe(409);
	});

	it('allows verified-on-both-sides accounts', async () => {
		userIdentities = [
			{ provider: 'email', identity_data: { email_verified: true }, created_at: '2026-10-01T00:00:00Z' },
			{ provider: 'google', identity_data: { email_verified: true }, created_at: '2026-10-02T00:00:00Z' },
		];
		userConfirmedAt = '2026-10-01T00:00:00Z';
		const result = await call(gateway, '/api/auth/osionos-session', { headers: { authorization: 'Bearer at' } });
		expect(result.status).toBe(200);
	});

	it('refuses when the account was confirmed after the provider identity was created', async () => {
		userIdentities = [
			{ provider: 'email', identity_data: { email_verified: true }, created_at: '2026-10-01T00:00:00Z' },
			{ provider: 'google', identity_data: { email_verified: true }, created_at: '2026-10-02T00:00:00Z' },
		];
		userConfirmedAt = '2026-10-03T00:00:00Z';
		const result = await call(gateway, '/api/auth/osionos-session', { headers: { authorization: 'Bearer at' } });
		expect(result.status).toBe(409);
	});

	it('refuses 42 in a multi-identity account', async () => {
		userIdentities = [
			{ provider: 'email', identity_data: { email_verified: true }, created_at: '2026-10-01T00:00:00Z' },
			{ provider: 'custom:fortytwo', identity_data: { email_verified: true }, created_at: '2026-10-02T00:00:00Z' },
		];
		userConfirmedAt = '2026-10-01T00:00:00Z';
		const result = await call(gateway, '/api/auth/osionos-session', { headers: { authorization: 'Bearer at' } });
		expect(result.status).toBe(409);
	});

	it('allows a single-identity 42 account', async () => {
		userIdentities = [{ provider: 'custom:fortytwo', identity_data: { email_verified: false }, created_at: '2026-10-02T00:00:00Z' }];
		const result = await call(gateway, '/api/auth/osionos-session', { headers: { authorization: 'Bearer at' } });
		expect(result.status).toBe(200);
	});

	it('returns 422 when 42 provides no email', async () => {
		userEmail = '';
		userIdentities = [{ provider: 'custom:fortytwo', identity_data: { email_verified: false }, created_at: '2026-10-02T00:00:00Z' }];
		const result = await call(gateway, '/api/auth/osionos-session', { headers: { authorization: 'Bearer at' } });
		expect(result.status).toBe(422);
	});

	it('treats custom:other with email_verified true as unverified', async () => {
		userIdentities = [
			{ provider: 'email', identity_data: { email_verified: true }, created_at: '2026-10-01T00:00:00Z' },
			{ provider: 'custom:other', identity_data: { email_verified: true }, created_at: '2026-10-02T00:00:00Z' },
		];
		userConfirmedAt = '2026-10-01T00:00:00Z';
		const result = await call(gateway, '/api/auth/osionos-session', { headers: { authorization: 'Bearer at' } });
		expect(result.status).toBe(409);
	});

	it('returns 503 when identities are unreadable', async () => {
		userIdentities = null;
		const result = await call(gateway, '/api/auth/osionos-session', { headers: { authorization: 'Bearer at' } });
		expect(result.status).toBe(503);
		expect(result.body.error).toBe('oauth_identity_unavailable');
	});

	it('audits a failed logout and still answers 409', async () => {
		userIdentities = [
			{ provider: 'email', identity_data: { email_verified: true }, created_at: '2026-10-01T00:00:00Z' },
			{ provider: 'google', identity_data: { email_verified: false }, created_at: '2026-10-02T00:00:00Z' },
		];
		logoutStatus = 500;
		const result = await call(gateway, '/api/auth/osionos-session', { headers: { authorization: 'Bearer at' } });
		expect(result.status).toBe(409);
		await new Promise((done) => setTimeout(done, 100));
		expect(audits('osionos_bridge_refused_logout_failed', userEmail)).toBe(1);
	});
});

describe('rate limit', () => {
	it('returns 429 with retry-after on the 31st call', async () => {
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
	it('answers 404 when the provider list is empty', async () => {
		const result = await call(emptyGateway, '/api/auth/oauth-session', { body: { code: 'c', verifier: 'v' } });
		expect(result.status).toBe(404);
		expect(hitsTo('/auth/v1/user')).toHaveLength(0);
	});

	it('refuses in OTP mode before any GoTrue call', async () => {
		const result = await call(otpGateway, '/api/auth/oauth-session', { body: { code: 'c', verifier: 'v' } });
		expect(result.status).toBe(409);
		expect(result.body.error).toBe('oauth_requires_password_login');
		expect(hitsTo('/auth/v1/user')).toHaveLength(0);
		expect(hitsTo('/auth/v1/token')).toHaveLength(0);
	});

	it('exchanges, sets the cookie, mints, and schedules the alert', async () => {
		userIdentities = [{ provider: 'email', identity_data: { email_verified: true }, created_at: '2026-10-01T00:00:00Z' }];
		const result = await call(oauthGateway, '/api/auth/oauth-session', { body: { code: 'code-1', verifier: 'verifier-1' } });
		expect(result.status).toBe(200);
		expect(result.body.refresh_token).toBeUndefined();
		expect(result.cookies.some((cookie) => cookie.startsWith('prismatica_refresh='))).toBe(true);
		expect(bridgeCalls).toHaveLength(1);
		await new Promise((done) => setTimeout(done, 500));
		expect(audits('login_alert_sent', userEmail)).toBe(1);
	});

	it('maps a bad verifier to 401 without minting', async () => {
		pkceStatus = 400;
		const result = await call(oauthGateway, '/api/auth/oauth-session', { body: { code: 'code-1', verifier: 'verifier-1' } });
		expect(result.status).toBe(401);
		expect(bridgeCalls).toHaveLength(0);
	});
});
