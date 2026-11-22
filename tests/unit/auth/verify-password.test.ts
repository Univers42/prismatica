// @vitest-environment node
// POST /api/auth/verify-password as a module: the bridge's sudo step-up asks whether a password is
// right. Every case maps to a condition of the 2026-11-22 devil ruling (VP1–VP15).
import { createHmac } from 'node:crypto';
import { Readable } from 'node:stream';
import { describe, expect, it, vi } from 'vitest';
import { loginLockKeys } from '../../../scripts/auth/identity.mjs';
import {
	createVerifyPassword,
	stepUpClientIp,
	VERIFY_PASSWORD_BODY_CAP,
	VERIFY_PASSWORD_GOTRUE_TIMEOUT_MS,
} from '../../../scripts/auth/verify-password.mjs';
import { fail, memoryStore, ok, type Result } from './fakes';

const SECRET = 'bridge-shared-secret-for-tests-0123456789';
const PATH = '/api/auth/verify-password';
const EMAIL = 'ana@arlet.test';
const LIVE_CHAIN = '203.0.113.66, 198.51.100.7, 100.64.0.1, 172.18.0.1';
const now = () => Math.floor(Date.now() / 1000);
// GoTrue's access token carries the session it belongs to in the session_id claim.
const jwt = (claims: object) => `h.${Buffer.from(JSON.stringify(claims)).toString('base64url')}.s`;
const MINTED = jwt({ sub: 'user-1', session_id: 'sess-9' });

// The bridge's own lines (osionos main scripts/bridge-account-sudo-password.mjs), byte for byte.
function bridgeSign(secret: string, timestamp: string, body: string) {
	return createHmac('sha256', secret).update(`${timestamp}.password.${PATH}.${body}`).digest('hex');
}

type Init = { body?: string; secret?: string; timestamp?: string; signature?: string; chunks?: Buffer[]; url?: string; headers?: Record<string, unknown> };
function stepUp(init: Init = {}) {
	const body = init.body ?? JSON.stringify({ email: EMAIL, password: 'Right-Pass-1!' });
	const timestamp = init.timestamp ?? String(now());
	const signature = init.signature ?? bridgeSign(init.secret ?? SECRET, timestamp, body);
	const request = Readable.from(init.chunks ?? [Buffer.from(body, 'utf8')]);
	const headers = { 'x-osionos-sudo-timestamp': timestamp, 'x-osionos-sudo-signature': signature, 'x-forwarded-for': LIVE_CHAIN, ...init.headers };
	return Object.assign(request, { url: init.url ?? PATH, headers, socket: { remoteAddress: '172.18.0.5' } });
}

function harness(options: { secret?: string | undefined; grant?: () => Promise<Result>; logout?: () => Promise<Result>; nowSec?: () => number } = {}) {
	const store = memoryStore();
	const gotrue = {
		passwordGrant: vi.fn(options.grant ?? (async () => ok({ access_token: MINTED, refresh_token: 'rt-minted', user: { id: 'user-1' } }))),
		logout: vi.fn(options.logout ?? (async () => ({ ok: true, status: 204, body: {} }))),
	};
	const audit = vi.fn(async () => undefined);
	const alertFailed = vi.fn();
	const warn = vi.fn();
	const lockout = { threshold: 10, windowSec: 900, lockSec: 900 };
	const verifier = createVerifyPassword({ secret: 'secret' in options ? options.secret : SECRET, store, gotrue, lockout, trustedProxyHops: 2, audit, alertFailed, warn, nowSec: options.nowSec ?? now });
	const events = () => audit.mock.calls.map((call: unknown[]) => ({ type: call[0], details: call[2] as Record<string, unknown> }));
	return { ...verifier, store, gotrue, audit, alertFailed, warn, events };
}

const BAD_SIGNATURE = { status: 400, body: { error: 'bad_signature' } };
const INVALID = { status: 401, body: { valid: false } };
const UNAVAILABLE = { status: 503, body: { error: 'verify_unavailable' } };

describe('VP1 — no secret, no check', () => {
	it.each([[''], [undefined]])('secret %j: a signature made with the empty key answers 503 and touches nothing', async (secret) => {
		const gate = harness({ secret });
		const result = await gate.handle(stepUp({ secret: '' }));
		expect(result).toMatchObject(UNAVAILABLE);
		expect(gate.gotrue.passwordGrant).not.toHaveBeenCalled();
		expect(gate.store.map.size).toBe(0);
		expect(gate.audit).not.toHaveBeenCalled();
	});
});

describe('VP2 — the signature covers the raw bytes', () => {
	it('verifies multi-byte UTF-8 and spaces split inside a code point across two chunks', async () => {
		const body = JSON.stringify({ email: EMAIL, password: 'pâss wörd 密码 🔐 ok' });
		const raw = Buffer.from(body, 'utf8');
		const split = raw.indexOf(Buffer.from('密', 'utf8')) + 1;
		const gate = harness();
		const result = await gate.handle(stepUp({ body, chunks: [raw.subarray(0, split), raw.subarray(split)] }));
		expect(result).toMatchObject({ status: 200, body: { valid: true } });
		expect(gate.gotrue.passwordGrant).toHaveBeenCalledWith(EMAIL, 'pâss wörd 密码 🔐 ok');
	});

	it('signs the constant path, never request.url', async () => {
		const accepted = await harness().handle(stepUp({ url: '/api/auth/verify-password?via=edge' }));
		expect(accepted.status).toBe(200);
		const body = JSON.stringify({ email: EMAIL, password: 'Right-Pass-1!' });
		const timestamp = String(now());
		const otherPath = createHmac('sha256', SECRET).update(`${timestamp}.password./api/auth/login.${body}`).digest('hex');
		expect(await harness().handle(stepUp({ body, timestamp, signature: otherPath }))).toMatchObject(BAD_SIGNATURE);
	});
});

describe('VP3/VP4 — every signature failure is a cheap, silent 400', () => {
	const body = JSON.stringify({ email: EMAIL, password: 'Right-Pass-1!' });
	const ts = () => String(now());
	const cases: [string, () => Init][] = [
		['no timestamp header', () => ({ headers: { 'x-osionos-sudo-timestamp': undefined } })],
		['no signature header', () => ({ headers: { 'x-osionos-sudo-signature': undefined } })],
		['a timestamp that is not digits', () => ({ timestamp: '17e9' })],
		['a 13-digit timestamp', () => ({ timestamp: '1'.repeat(13) })],
		['a timestamp 61 s old', () => ({ timestamp: String(now() - 61) })],
		['a timestamp 61 s ahead', () => ({ timestamp: String(now() + 61) })],
		['an upper-case signature', () => ({ signature: bridgeSign(SECRET, ts(), body).toUpperCase() })],
		['a 63-character signature', () => ({ signature: 'a'.repeat(63) })],
		['a signature made with another secret', () => ({ secret: 'not-the-bridge-secret' })],
		['a body changed after signing', () => {
			const timestamp = ts();
			return { timestamp, signature: bridgeSign(SECRET, timestamp, body), body: body.replace('Right', 'Wrong') };
		}],
	];
	it.each(cases)('%s: 400 bad_signature, no password check, no audit, no store write', async (_name, init) => {
		const gate = harness();
		const result = await gate.handle(stepUp(init()));
		expect(result).toEqual(BAD_SIGNATURE);
		expect(gate.gotrue.passwordGrant).not.toHaveBeenCalled();
		expect(gate.audit).not.toHaveBeenCalled();
		expect(gate.store.map.size).toBe(0);
	});

	// The clock is pinned: on the real one, a second ticking between signing and checking makes it 61 s.
	it('accepts a timestamp exactly 60 s old', async () => {
		const clock = now();
		expect((await harness({ nowSec: () => clock }).handle(stepUp({ timestamp: String(clock - 60) }))).status).toBe(200);
	});

	it('accepts one signature once: a replay is a 400 and the password is checked once', async () => {
		const gate = harness();
		const timestamp = String(now());
		expect((await gate.handle(stepUp({ timestamp }))).status).toBe(200);
		expect(await gate.handle(stepUp({ timestamp }))).toEqual(BAD_SIGNATURE);
		expect(gate.gotrue.passwordGrant).toHaveBeenCalledTimes(1);
	});

	it('writes the replay marker only after the HMAC matched', async () => {
		const gate = harness();
		const spy = vi.spyOn(gate.store, 'setIfAbsent');
		await gate.handle(stepUp({ secret: 'not-the-bridge-secret' }));
		expect(spy).not.toHaveBeenCalled();
		await gate.handle(stepUp());
		expect(spy).toHaveBeenCalledWith(expect.stringMatching(/^sudoproof:[0-9a-f]{64}$/), '1', 120);
	});

	it('fails closed when the replay store is down: 503, no password check', async () => {
		const gate = harness();
		vi.spyOn(gate.store, 'setIfAbsent').mockRejectedValue(new Error('redis not connected'));
		expect(await gate.handle(stepUp())).toEqual(UNAVAILABLE);
		expect(gate.gotrue.passwordGrant).not.toHaveBeenCalled();
	});

	it('warns at most once a minute however many refusals arrive', async () => {
		const gate = harness();
		for (let attempt = 0; attempt < 5; attempt += 1) await gate.handle(stepUp({ signature: 'f'.repeat(64) }));
		expect(gate.warn).toHaveBeenCalledTimes(1);
	});
});

describe('VP5 — body cap and malformed credentials', () => {
	it('refuses a body over 8 KiB with 413 before any check', async () => {
		const body = JSON.stringify({ email: EMAIL, password: 'x'.repeat(VERIFY_PASSWORD_BODY_CAP) });
		const gate = harness();
		expect(await gate.handle(stepUp({ body }))).toEqual({ status: 413, body: { error: 'body_too_large' } });
		expect(gate.store.map.size).toBe(0);
	});

	it.each([
		['an address that fails EMAIL_REGEX', { email: 'not-an-address', password: 'Right-Pass-1!' }],
		['an empty password', { email: EMAIL, password: '' }],
		['a password that is not a string', { email: EMAIL, password: 12345678 }],
	])('%s: 401 {valid:false}, no grant, no counter', async (_name, credentials) => {
		const gate = harness();
		expect(await gate.handle(stepUp({ body: JSON.stringify(credentials) }))).toEqual(INVALID);
		expect(gate.gotrue.passwordGrant).not.toHaveBeenCalled();
		expect(await gate.store.get(loginLockKeys(EMAIL).fail)).toBeNull();
	});

	it('answers 400 to a signed body that is not a JSON object: the bridge erred, the user did not', async () => {
		const gate = harness();
		expect(await gate.handle(stepUp({ body: '[1,2]' }))).toEqual({ status: 400, body: { error: 'bad_request' } });
		expect(await gate.handle(stepUp({ body: '{oops' }))).toEqual({ status: 400, body: { error: 'bad_request' } });
		expect(gate.gotrue.passwordGrant).not.toHaveBeenCalled();
	});
});

describe('VP6 — the per-account lockout is the login one', () => {
	it('a locked account answers 429 with the lock time left and the password unchecked', async () => {
		const gate = harness();
		await gate.store.set(loginLockKeys(EMAIL).lock, '1', 300);
		const result = await gate.handle(stepUp());
		expect(result).toMatchObject({ status: 429, body: { error: 'locked' } });
		expect(Number(result.headers?.['retry-after'])).toBeGreaterThan(295);
		expect(Number(result.headers?.['retry-after'])).toBeLessThanOrEqual(300);
		expect(gate.gotrue.passwordGrant).not.toHaveBeenCalled();
	});

	it('locks the account at the tenth wrong password, then answers 429', async () => {
		const gate = harness({ grant: async () => fail(400, { error: 'invalid_grant' }) });
		// Ten distinct timestamps sign ten distinct requests; a repeated one would be refused as a replay.
		const start = now();
		for (let attempt = 1; attempt <= 10; attempt += 1) expect(await gate.handle(stepUp({ timestamp: String(start - attempt) }))).toEqual(INVALID);
		expect(await gate.store.pttl(loginLockKeys(EMAIL).lock)).toBeGreaterThan(0);
		expect((await gate.handle(stepUp())).status).toBe(429);
		expect(gate.gotrue.passwordGrant).toHaveBeenCalledTimes(10);
	});
});

describe('VP9/VP10 — the user\'s address, one hop left of the bridge', () => {
	it('takes the client two trusted hops plus the bridge\'s own from the right of the live chain', () => {
		const request = { headers: { 'x-forwarded-for': LIVE_CHAIN }, socket: { remoteAddress: '172.18.0.5' } };
		expect(stepUpClientIp(request, 2)).toBe('198.51.100.7');
	});

	it('puts that address in every audit row, success and failure', async () => {
		const good = harness();
		await good.handle(stepUp());
		const bad = harness({ grant: async () => fail(400, { error: 'invalid_grant' }) });
		await bad.handle(stepUp());
		const rows = [...good.events(), ...bad.events()];
		expect(rows.map((row) => row.type)).toEqual(expect.arrayContaining(['sudo_password_verified', 'sudo_password_failed']));
		for (const row of rows) expect(row.details.ip_address).toBe('198.51.100.7');
	});
});

describe('VP8/VP11/VP15 — the minted session is revoked with scope local', () => {
	it('keeps the grant plus the revoke under the bridge\'s 8 s', () => {
		expect(2 * VERIFY_PASSWORD_GOTRUE_TIMEOUT_MS).toBeLessThan(8_000);
	});

	it('revokes the minted token with the literal scope local and audits revoked:true', async () => {
		const gate = harness();
		await gate.handle(stepUp());
		expect(gate.gotrue.logout).toHaveBeenCalledWith(MINTED, 'local');
		expect(gate.events()).toContainEqual({ type: 'sudo_password_verified', details: expect.objectContaining({ revoked: true }) });
	});

	it('revokes before clearing the failure count: a stalled store never delays the revoke', async () => {
		const gate = harness();
		vi.spyOn(gate.store, 'del').mockReturnValue(new Promise<never>(() => undefined));
		void gate.handle(stepUp());
		await vi.waitFor(() => expect(gate.gotrue.logout).toHaveBeenCalledWith(MINTED, 'local'));
	});

	it('still answers 200 when the revoke fails, and audits the session for an operator to delete', async () => {
		const gate = harness({ logout: async () => fail(500) });
		expect(await gate.handle(stepUp())).toEqual({ status: 200, body: { valid: true } });
		const failed = gate.events().find((row) => row.type === 'sudo_password_session_revoke_failed');
		expect(failed?.details).toMatchObject({ user_id: 'user-1', session_id: 'sess-9', status: 500 });
		expect(gate.events()).toContainEqual({ type: 'sudo_password_verified', details: expect.objectContaining({ revoked: false }) });
		expect(JSON.stringify(gate.audit.mock.calls)).not.toMatch(/rt-minted|h\.ey/);
	});
});

describe('VP12 — what each GoTrue answer means', () => {
	it('a wrong password: 401, one failure counted, the failed alert, audited', async () => {
		const gate = harness({ grant: async () => fail(400, { error: 'invalid_grant' }) });
		expect(await gate.handle(stepUp())).toEqual(INVALID);
		expect(await gate.store.get(loginLockKeys(EMAIL).fail)).toBe('1');
		expect(gate.alertFailed).toHaveBeenCalledWith(expect.anything(), EMAIL);
		expect(gate.events().map((row) => row.type)).toContain('sudo_password_failed');
	});

	it('an unconfirmed address: 403 {valid:false}, nothing counted, no alert', async () => {
		const gate = harness({ grant: async () => fail(400, { error_code: 'email_not_confirmed' }) });
		expect(await gate.handle(stepUp())).toEqual({ status: 403, body: { valid: false } });
		expect(await gate.store.get(loginLockKeys(EMAIL).fail)).toBeNull();
		expect(gate.alertFailed).not.toHaveBeenCalled();
	});

	it.each([[429], [500], [401], [0]])('GoTrue %i: 503, never 429 or 401, nothing counted', async (status) => {
		const gate = harness({ grant: async () => fail(status) });
		expect(await gate.handle(stepUp())).toEqual(UNAVAILABLE);
		expect(await gate.store.get(loginLockKeys(EMAIL).fail)).toBeNull();
		expect(gate.alertFailed).not.toHaveBeenCalled();
	});

	it('a success clears the failure count and never the lock a concurrent attempt set', async () => {
		const keys = loginLockKeys(EMAIL);
		const gate = harness({
			grant: async () => {
				await gate.store.set(keys.lock, '1', 900);
				return ok({ access_token: MINTED, user: { id: 'user-1' } });
			},
		});
		await gate.store.set(keys.fail, '3', 900);
		expect(await gate.handle(stepUp())).toEqual({ status: 200, body: { valid: true } });
		expect(await gate.store.get(keys.fail)).toBeNull();
		expect(await gate.store.get(keys.lock)).toBe('1');
	});
});

describe('VP13 — no answer carries a credential', () => {
	const outcomes: [string, () => Promise<Result>][] = [
		['success', async () => ok({ access_token: MINTED, refresh_token: 'rt-minted', user: { id: 'user-1', email: EMAIL } })],
		['wrong password', async () => fail(400, { error: 'invalid_grant' })],
		['unconfirmed', async () => fail(400, { error_code: 'email_not_confirmed' })],
		['upstream', async () => fail(502)],
	];
	it.each(outcomes)('%s: the body is {valid} or {error} alone, with no set-cookie', async (_name, grant) => {
		const result = await harness({ grant }).handle(stepUp());
		expect([['valid'], ['error']]).toContainEqual(Object.keys(result.body));
		expect(Object.keys(result.headers ?? {}).map((name) => name.toLowerCase())).not.toContain('set-cookie');
		expect(JSON.stringify(result)).not.toMatch(/rt-minted|user-1|ana@/);
	});
});
