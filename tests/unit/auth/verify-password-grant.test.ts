// @vitest-environment node
// POST /api/auth/verify-password as a module, from the lockout on: the grant, its revoke, the audit
// rows and what each GoTrue answer means (devil ruling 2026-11-22, VP6, VP8, VP11, VP12, VP15).
import { describe, expect, it, vi } from 'vitest';
import { loginLockKeys } from '../../../scripts/auth/identity.mjs';
import { VERIFY_PASSWORD_AUDIT_TIMEOUT_MS, VERIFY_PASSWORD_GOTRUE_TIMEOUT_MS } from '../../../scripts/auth/verify-password.mjs';
import { fail, ok } from './fakes';
import { EMAIL, harness, INVALID, MINTED, now, stepUp, UNAVAILABLE } from './verify-password-harness';

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

describe('one grant in flight per account: parallel guesses cannot outrun the lockout', () => {
	const slowWrong = async () => {
		await new Promise((done) => setTimeout(done, 5));
		return fail(400, { error: 'invalid_grant' });
	};

	it('30 parallel wrong passwords reach the grant at most threshold times; the rest answer 429', async () => {
		const gate = harness({ grant: slowWrong });
		const start = now();
		const results = await Promise.all(Array.from({ length: 30 }, (_, index) => gate.handle(stepUp({ timestamp: String(start - index) }))));
		const grants = gate.gotrue.passwordGrant.mock.calls.length;
		expect(grants).toBeLessThanOrEqual(10);
		const refused = results.filter((result) => result.status === 429);
		expect(refused).toHaveLength(30 - grants);
		for (const result of refused) expect(result).toMatchObject({ body: { error: 'busy' }, headers: { 'retry-after': '1' } });
	});

	it('gives the turn back after each attempt, even when the grant throws', async () => {
		let calls = 0;
		const gate = harness({ grant: async () => (calls++ === 0 ? Promise.reject(new Error('socket hang up')) : ok({ access_token: MINTED, user: { id: 'user-1' } })) });
		const start = now();
		expect(await gate.handle(stepUp({ timestamp: String(start) }))).toEqual(UNAVAILABLE);
		expect(await gate.handle(stepUp({ timestamp: String(start - 1) }))).toEqual({ status: 200, body: { valid: true } });
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

describe('VP8 — an audit row never holds the answer', () => {
	const withFakeTimeouts = async (run: () => Promise<void>) => {
		vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
		try {
			await run();
		} finally {
			vi.useRealTimers();
		}
	};

	it('answers a verified step-up within 1.5 s when the audit never resolves, and logs the late row', () => withFakeTimeouts(async () => {
		const gate = harness();
		gate.audit.mockImplementation(() => new Promise<undefined>(() => undefined));
		let answer: unknown;
		void gate.handle(stepUp()).then((result) => { answer = result; });
		await vi.advanceTimersByTimeAsync(1_500);
		expect(answer).toEqual({ status: 200, body: { valid: true } });
		expect(gate.warn).toHaveBeenCalledWith(expect.stringMatching(/sudo_password_verified/));
	}));

	it('bounds each audit at 1.5 s or less and clears the timer when the row lands', () => withFakeTimeouts(async () => {
		expect(VERIFY_PASSWORD_AUDIT_TIMEOUT_MS).toBeLessThanOrEqual(1_500);
		await harness().handle(stepUp());
		expect(vi.getTimerCount()).toBe(0);
	}));
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

	it('a grant timeout (status 0) is audited for an operator, with no token, then answers 503', async () => {
		const gate = harness({ grant: async () => fail(0) });
		expect(await gate.handle(stepUp())).toEqual(UNAVAILABLE);
		expect(gate.events()).toEqual([{ type: 'sudo_password_grant_timeout', details: { email: EMAIL, ip_address: '198.51.100.7' } }]);
		expect(gate.audit.mock.calls[0][1]).toHaveProperty('headers');
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
