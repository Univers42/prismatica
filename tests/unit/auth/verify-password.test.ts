// @vitest-environment node
// POST /api/auth/verify-password as a module, up to the password check: the secret, the signature,
// the body and the answer's shape (devil ruling 2026-11-22, VP1–VP5, VP9, VP10, VP13).
import { createHmac } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { loginLockKeys } from '../../../scripts/auth/identity.mjs';
import { stepUpClientIp, VERIFY_PASSWORD_BODY_CAP } from '../../../scripts/auth/verify-password.mjs';
import { fail, ok, type Result } from './fakes';
import { BAD_SIGNATURE, bridgeSign, EMAIL, harness, INVALID, type Init, LIVE_CHAIN, MINTED, now, SECRET, stepUp, UNAVAILABLE } from './verify-password-harness';

describe('VP1 — no secret, no check', () => {
	it.each([[''], [undefined]])('secret %j: a signature made with the empty key answers 503 and touches nothing', async (secret) => {
		const gate = harness({ secret });
		const result = await gate.handle(stepUp({ secret: '' }));
		expect(result).toMatchObject(UNAVAILABLE);
		expect(gate.gotrue.passwordGrant).not.toHaveBeenCalled();
		expect(gate.store.map.size).toBe(0);
		expect(gate.audit).not.toHaveBeenCalled();
	});

	it.each([[' '], [' '.repeat(40)], ['x'.repeat(31)]])('weak secret %j: 503 before the HMAC, even to a signature made with that key', async (secret) => {
		const gate = harness({ secret });
		expect(await gate.handle(stepUp({ secret }))).toEqual(UNAVAILABLE);
		expect(gate.gotrue.passwordGrant).not.toHaveBeenCalled();
		expect(gate.store.map.size).toBe(0);
	});

	it('accepts a secret of exactly 32 characters', async () => {
		const secret = 'x'.repeat(32);
		expect((await harness({ secret }).handle(stepUp({ secret }))).status).toBe(200);
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
