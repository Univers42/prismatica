// @vitest-environment node
// The real scripts/auth-gateway.mjs serving POST /api/auth/verify-password against the fake Kong,
// signed exactly as the osionos bridge signs it. Live shape: two trusted hops, the e-mailed sign-in
// code and the approve link on (devil ruling 2026-11-22, VP1–VP16).
import { createHmac } from 'node:crypto';
import http from 'node:http';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { call, hits, hitsTo, loginBody, startFakeKong, startGateway, stopAll, upstream, type Gateway } from './gateway-harness';

const SECRET = 'bridge-shared-secret-for-tests-0123456789';
const PATH = '/api/auth/verify-password';
const LIVE_CHAIN = '203.0.113.66, 198.51.100.7, 100.64.0.1, 172.18.0.1';
const AUDIT = '/rest/v1/rpc/auth_record_audit_event';
const now = () => Math.floor(Date.now() / 1000);
let gateway: Gateway;
let noSecret: Gateway;

beforeAll(async () => {
	await startFakeKong();
	const live = { AUTH_TRUSTED_PROXY_HOPS: '2', AUTH_LOGIN_EMAIL_OTP: 'true', AUTH_LOGIN_APPROVE_LINK: 'true' };
	gateway = await startGateway({ ...live, OSIONOS_BRIDGE_SHARED_SECRET: SECRET });
	noSecret = await startGateway({ ...live, OSIONOS_BRIDGE_SHARED_SECRET: '' });
}, 30_000);

afterAll(stopAll);

// The bridge's signing line (osionos main scripts/bridge-account-sudo-password.mjs), byte for byte.
const bridgeSign = (secret: string, timestamp: string, body: string) =>
	createHmac('sha256', secret).update(`${timestamp}.password.${PATH}.${body}`).digest('hex');

type StepUp = { email?: string; password?: string; secret?: string; timestamp?: string; signed?: boolean };
async function stepUp(target: Gateway, init: StepUp = {}) {
	const body = JSON.stringify({ email: init.email ?? 'ok@arlet.test', password: init.password ?? 'Right-Pass-1!' });
	const timestamp = init.timestamp ?? String(now());
	const signature = init.signed === false ? {} : { 'x-osionos-sudo-timestamp': timestamp, 'x-osionos-sudo-signature': bridgeSign(init.secret ?? SECRET, timestamp, body) };
	const response = await fetch(`${target.base}${PATH}`, {
		method: 'POST',
		headers: { accept: 'application/json', 'content-type': 'application/json', 'x-forwarded-for': LIVE_CHAIN, ...signature },
		body,
	});
	const text = await response.text();
	return { status: response.status, text, body: JSON.parse(text), cookies: response.headers.getSetCookie(), retryAfter: response.headers.get('retry-after') };
}

const settle = () => new Promise((done) => setTimeout(done, 400));
const auditEvents = () => hitsTo(AUDIT).map((hit) => JSON.parse(hit.body));

describe('a signed step-up with the right password', () => {
	it('answers exactly {valid:true}, revokes the minted session with scope local, and sends no mail or code (VP11, VP13, VP14)', async () => {
		hits.length = 0;
		upstream.passwordStatus = 200;
		const result = await stepUp(gateway);
		await settle();
		expect(result.status).toBe(200);
		expect(result.text).toBe('{"valid":true}');
		expect(result.cookies).toEqual([]);
		expect(hitsTo('/auth/v1/token').map((hit) => hit.path)).toEqual(['/auth/v1/token?grant_type=password']);
		expect(hitsTo('/auth/v1/logout').map((hit) => hit.path)).toEqual(['/auth/v1/logout?scope=local']);
		expect(hitsTo('/email/v1/send')).toHaveLength(0);
		expect(hitsTo('/v1/auth/otp/request')).toHaveLength(0);
		const verified = auditEvents().find((event) => event.event_type === 'sudo_password_verified');
		expect(verified.details).toMatchObject({ ip_address: '198.51.100.7', revoked: true });
	});

	it('verifies a multi-byte password delivered in two TCP writes split inside a code point (VP2)', async () => {
		upstream.passwordStatus = 200;
		const body = JSON.stringify({ email: 'ok@arlet.test', password: 'pâss wörd 密码 🔐' });
		const raw = Buffer.from(body, 'utf8');
		const split = raw.indexOf(Buffer.from('密', 'utf8')) + 1;
		const timestamp = String(now());
		const url = new URL(`${gateway.base}${PATH}`);
		const status = await new Promise<number>((done, reject) => {
			const request = http.request({ host: url.hostname, port: url.port, path: PATH, method: 'POST', headers: { 'content-type': 'application/json', 'content-length': raw.length, 'x-osionos-sudo-timestamp': timestamp, 'x-osionos-sudo-signature': bridgeSign(SECRET, timestamp, body) } }, (response) => {
				response.resume();
				done(response.statusCode ?? 0);
			});
			request.on('error', reject);
			request.write(raw.subarray(0, split));
			setTimeout(() => request.end(raw.subarray(split)), 50);
		});
		expect(status).toBe(200);
	});
});

describe('a signature failure on the public path', () => {
	it('answers 400 bad_signature with no GoTrue call and no audit row (VP3, VP4)', async () => {
		hits.length = 0;
		const unsigned = await stepUp(gateway, { signed: false });
		const wrongKey = await stepUp(gateway, { secret: 'not-the-bridge-secret' });
		const stale = await stepUp(gateway, { timestamp: String(now() - 120) });
		await settle();
		for (const result of [unsigned, wrongKey, stale]) expect(result).toMatchObject({ status: 400, body: { error: 'bad_signature' } });
		expect(hitsTo('/auth/v1/token')).toHaveLength(0);
		expect(hitsTo(AUDIT)).toHaveLength(0);
	});

	it('answers 503 on a gateway with no secret, even to a signature made with the empty key (VP1)', async () => {
		hits.length = 0;
		const result = await stepUp(noSecret, { secret: '' });
		expect(result).toMatchObject({ status: 503, body: { error: 'verify_unavailable' } });
		expect(hitsTo('/auth/v1/token')).toHaveLength(0);
	});
});

describe('one lockout for /login and /verify-password (VP6)', () => {
	it('ten failed sign-ins lock the step-up, with Retry-After', async () => {
		upstream.passwordStatus = 400;
		for (let attempt = 0; attempt < 10; attempt += 1) expect((await call(gateway, '/api/auth/login', { body: loginBody('lock-a@arlet.test') })).status).toBe(401);
		upstream.passwordStatus = 200;
		const result = await stepUp(gateway, { email: 'lock-a@arlet.test' });
		expect(result).toMatchObject({ status: 429, body: { error: 'locked' } });
		expect(Number(result.retryAfter)).toBeGreaterThan(0);
	});

	it('ten wrong step-up passwords lock /login', async () => {
		upstream.passwordStatus = 400;
		for (let attempt = 1; attempt <= 10; attempt += 1) expect((await stepUp(gateway, { email: 'lock-b@arlet.test', timestamp: String(now() - attempt) })).status).toBe(401);
		upstream.passwordStatus = 200;
		expect((await call(gateway, '/api/auth/login', { body: loginBody('lock-b@arlet.test') })).status).toBe(429);
	});
});
