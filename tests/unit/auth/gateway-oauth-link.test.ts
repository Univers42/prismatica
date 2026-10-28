// @vitest-environment node
// AUTH_OAUTH_LINK_EXISTING through the real gateway: a provider sign-in to an account that already
// has a password. off and observe keep the 409 and change nothing (C380); on removes the password,
// signs out the rest, revokes tokens, mails the owner, then mints, and always alerts (C351, C373).
import http from 'node:http';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { boot, call, hits, hitsTo, listen, servers, startFakeKong, startGateway, stopAll, upstream, type Gateway } from './gateway-harness';

const SECRET = 'bridge-shared-secret-for-tests-0123456789';
const OAUTH = { origin: 'https://localhost:4322' };
const EXCHANGE = { code: 'code-1', verifier: 'verifier-1' };
const EMAIL = 'ines@arlet.test';
const EMAIL_IDENTITY = { provider: 'email', identity_data: { email_verified: false }, created_at: '2026-10-01T00:00:00Z' };
const GOOGLE = { provider: 'google', identity_data: { email: EMAIL, email_verified: true }, created_at: '2026-10-02T00:00:00Z' };
const ACCOUNT = { id: 'u1', email: EMAIL, email_confirmed_at: '2026-10-01T00:00:00Z', identities: [EMAIL_IDENTITY, GOOGLE], user_metadata: { username: 'ines' }, app_metadata: {} };

const bridgeCalls: string[] = [];
const gateways: Record<'off' | 'observe' | 'on', Gateway> = {} as never;

const settle = () => new Promise((done) => setTimeout(done, 400));
const mutations = () => hits.filter((hit) => ['PUT', 'PATCH', 'DELETE'].includes(hit.method) || (hit.method === 'POST' && hit.path.startsWith('/rest/v1/auth_session_cutoffs')));
const audited = (event: string) => hits.filter((hit) => hit.path.includes('auth_record_audit_event') && hit.body.includes(`"${event}"`));
const mails = (subject: string) => hitsTo('/email/v1/send').filter((hit) => JSON.parse(hit.body).subject === subject);
const signIn = (gateway: Gateway) => call(gateway, '/api/auth/oauth-session', { headers: OAUTH, ip: '203.0.113.9', body: EXCHANGE });

beforeAll(async () => {
	await startFakeKong();
	const bridge = http.createServer((request, response) => {
		let body = '';
		request.on('data', (chunk) => (body += chunk));
		request.on('end', () => {
			bridgeCalls.push(body);
			response.writeHead(200, { 'content-type': 'application/json' });
			response.end(JSON.stringify({ redirectUrl: 'https://app.example.test/home', access_token: 'bridge-at', token_type: 'bearer' }));
		});
	});
	const wiring = { OSIONOS_BRIDGE_URL: `http://127.0.0.1:${await listen(bridge)}/s`, OSIONOS_BRIDGE_SHARED_SECRET: SECRET };
	servers.push(bridge);
	gateways.off = await startGateway(wiring);
	gateways.observe = await startGateway({ ...wiring, AUTH_OAUTH_LINK_EXISTING: 'observe' });
	gateways.on = await startGateway({ ...wiring, AUTH_OAUTH_LINK_EXISTING: 'on' });
}, 30_000);

afterAll(stopAll);

beforeEach(async () => {
	await settle();
	hits.length = 0;
	bridgeCalls.length = 0;
	upstream.user = { ...ACCOUNT, amr: [{ method: 'oauth' }] };
	upstream.adminUser = null;
	upstream.factorsStatus = 200;
	upstream.factors = [];
	upstream.settings = { mailer_autoconfirm: true, external: { google: true, github: true, email: true } };
	upstream.settingsStatus = 200;
	upstream.mailStatus = 200;
});

describe('AUTH_OAUTH_LINK_EXISTING', () => {
	it('refuses to boot on a value that is not off, observe or on', async () => {
		const result = await boot({ PUBLIC_BAAS_URL: 'http://127.0.0.1:1', AUTH_OAUTH_LINK_EXISTING: 'yes' });
		expect(result.code).not.toBeNull();
		expect(result.output).toContain('AUTH_OAUTH_LINK_EXISTING must be one of: off, observe, on.');
	});

	it('off: keeps the 409 and never reads the account through the admin API', async () => {
		const result = await signIn(gateways.off);
		expect(result.status).toBe(409);
		expect(result.body.error).toBe('oauth_email_collision');
		expect(hits.filter((hit) => hit.path.startsWith('/auth/v1/admin/'))).toHaveLength(0);
		expect(bridgeCalls).toHaveLength(0);
	});

	it('observe: still 409, audits what on would do, and changes nothing (C380)', async () => {
		const result = await signIn(gateways.observe);
		expect(result.status).toBe(409);
		expect(result.body.error).toBe('oauth_email_collision');
		await settle();
		const [observed] = audited('oauth_link_refused');
		expect(JSON.parse(observed.body).details).toMatchObject({ reason: 'observe', would_reset: true, would_refuse_reason: null });
		expect(mutations()).toEqual([]);
		expect(bridgeCalls).toHaveLength(0);
	});

	it('on: removes the password, signs out the rest, revokes tokens, mails, then opens the account', async () => {
		const result = await signIn(gateways.on);
		expect(result.status).toBe(200);
		expect(result.body.credential_reset).toBe(true);
		expect(result.cookies.some((cookie) => cookie.startsWith('prismatica_refresh='))).toBe(true);
		expect(bridgeCalls).toHaveLength(1);
		const steps = mutations().map((hit) => `${hit.method} ${hit.path.split('?')[0]}`);
		expect(steps).toEqual([
			'PUT /auth/v1/admin/users/u1',
			'POST /rest/v1/auth_session_cutoffs',
			'PATCH /rest/v1/ai_access_tokens',
			'PATCH /rest/v1/osionos_personal_access_tokens',
			'PUT /auth/v1/admin/users/u1',
		]);
		expect(hitsTo('/auth/v1/logout?scope=others')).toHaveLength(1);
		expect(JSON.parse(mutations()[0].body)).toHaveProperty('password');
		expect(JSON.parse(mutations()[4].body)).toMatchObject({ app_metadata: { mailbox_proof: { email: EMAIL, by: 'oauth_link_reset' } } });
		await settle();
		expect(mails('Your sign-in was linked and your password removed')).toHaveLength(1);
		expect(audited('oauth_account_linked')).toHaveLength(1);
	});

	it('on: a sign-in that removed a password alerts even right after an alert to the same client (C373)', async () => {
		await signIn(gateways.on);
		await settle();
		await signIn(gateways.on);
		await settle();
		expect(mails('Security alert: new Prismatica sign-in')).toHaveLength(2);
	});

	it('on: an account already proven by a password reset opens with no change', async () => {
		upstream.adminUser = { ...ACCOUNT, app_metadata: { mailbox_proof: { at: '2026-10-20T00:00:00Z', email: EMAIL, by: 'password_reset' } } };
		const result = await signIn(gateways.on);
		expect(result.status).toBe(200);
		expect(result.body.credential_reset).toBeUndefined();
		expect(mutations()).toEqual([]);
	});

	it('on: an account with an authenticator is refused untouched, and the provider session revoked', async () => {
		upstream.factors = [{ id: 'f1', status: 'verified', factor_type: 'totp' }];
		const result = await signIn(gateways.on);
		expect(result.status).toBe(409);
		expect(result.body.error).toBe('oauth_mfa_account');
		expect(result.cookies).toEqual([]);
		await settle();
		expect(mutations()).toEqual([]);
		expect(hitsTo('/auth/v1/logout?scope=local')).toHaveLength(1);
		expect(bridgeCalls).toHaveLength(0);
	});

	it('on: unreadable factors answer 503 and change nothing', async () => {
		upstream.factorsStatus = 500;
		const result = await signIn(gateways.on);
		expect(result.status).toBe(503);
		expect(result.body.error).toBe('oauth_link_unavailable');
		expect(mutations()).toEqual([]);
	});
});
