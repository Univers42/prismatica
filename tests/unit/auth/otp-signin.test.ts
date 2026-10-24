// @vitest-environment node
// The passwordless code sign-in's custody: issue, attempt caps, single use, TTL, the hand-off to GoTrue.
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as custody from '../../../scripts/auth/code-custody.mjs';
import { createOtpSignin, SIGNIN_CODE_INVALID } from '../../../scripts/auth/otp-signin.mjs';
import { fakeGotrue, memoryStore, ok } from './fakes';

// Spies that still call through, so a test can count hashing and comparing.
vi.mock('../../../scripts/auth/code-custody.mjs', async (importOriginal) => {
	const actual = await importOriginal<typeof import('../../../scripts/auth/code-custody.mjs')>();
	return { ...actual, hashCode: vi.fn(actual.hashCode), sameCode: vi.fn(actual.sameCode) };
});

const KEY = 'otp-signin-test-signing-key-0123456789abcdef';
const EMAIL = 'ines@arlet.test';
const HASH = 'd'.repeat(56);
const USER = { id: 'u1', email: EMAIL, email_confirmed_at: '2026-10-01T00:00:00Z' };
const REFUSED = { status: 401, body: SIGNIN_CODE_INVALID };

function setup(gotrueOverrides: Parameters<typeof fakeGotrue>[0] = {}, signingKey = KEY) {
	const { api } = fakeGotrue({
		findUserByEmail: async (email: string) => (email === EMAIL ? USER : null),
		generateLink: async () => ok({ hashed_token: HASH }),
		verify: async () => ok({ access_token: 'at', refresh_token: 'rt', token_type: 'bearer', expires_in: 3600, user: { id: 'u1', email: EMAIL } }),
		...gotrueOverrides,
	});
	const store = memoryStore();
	const audit = vi.fn();
	return { otp: createOtpSignin({ store, gotrue: api, signingKey, audit }), store, api, audit };
}

const wrongFor = (code: string) => (code === '000000' ? '000001' : '000000');

afterEach(() => vi.useRealTimers());

describe('issue', () => {
	it('returns a 6-digit code for a confirmed user and stores only a hash of it', async () => {
		const { otp, store } = setup();
		const code = await otp.issue(EMAIL);
		expect(code).toMatch(/^\d{6}$/);
		const kept = [...(store as any).map.values()].map((entry: any) => entry.value).join('|');
		expect(kept).not.toContain(code);
		expect(kept.length).toBeGreaterThan(64);
	});

	it('issues nothing and stores nothing for an address with no confirmed user', async () => {
		const { otp, store } = setup();
		expect(await otp.issue('nobody@arlet.test')).toBe('');
		expect((store as any).map.size).toBe(0);
	});

	it('issues nothing without a signing key', async () => {
		const { otp } = setup({}, '');
		expect(await otp.issue(EMAIL)).toBe('');
	});

	it('sets the stored code to live CODE_TTL_SEC (600 s)', async () => {
		const { otp, store } = setup();
		const set = vi.spyOn(store, 'set');
		await otp.issue(EMAIL);
		expect(set.mock.calls[0][2]).toBe(600);
	});
});

describe('verify: the right code', () => {
	it('answers 200 with the session body, no refresh token in it, and the refresh token apart', async () => {
		const { otp, api } = setup();
		const code = await otp.issue(EMAIL);
		const result = await otp.verify(EMAIL.toUpperCase(), code);
		expect(result.status).toBe(200);
		expect(result.body).toEqual({ access_token: 'at', token_type: 'bearer', expires_in: 3600, user: { id: 'u1', email: EMAIL } });
		expect(result.refreshToken).toBe('rt');
		expect(result.email).toBe(EMAIL);
		expect(api.generateLink).toHaveBeenCalledWith({ type: 'magiclink', email: EMAIL });
		expect(api.verify).toHaveBeenCalledWith('magiclink', HASH);
	});

	it('removes the stored code once it has made a session', async () => {
		const { otp, store } = setup();
		const code = await otp.issue(EMAIL);
		const live = () => [...(store as any).map.keys()].filter((key: string) => /^signin-code:[0-9a-f]+$/.test(key));
		expect(live()).toHaveLength(1);
		await otp.verify(EMAIL, code);
		expect(live()).toHaveLength(0);
	});

	it('is single use: the same code twice, one after the other, is refused the second time', async () => {
		const { otp } = setup();
		const code = await otp.issue(EMAIL);
		expect((await otp.verify(EMAIL, code)).status).toBe(200);
		expect(await otp.verify(EMAIL, code)).toEqual(REFUSED);
	});

	it('is single use under a race: two simultaneous right codes make one session', async () => {
		const { otp, api } = setup();
		const code = await otp.issue(EMAIL);
		const results = await Promise.all([otp.verify(EMAIL, code), otp.verify(EMAIL, code)]);
		expect(results.map((result) => result.status).sort()).toEqual([200, 401]);
		expect(api.verify).toHaveBeenCalledTimes(1);
	});

	it('expires after 600 s', async () => {
		vi.useFakeTimers({ toFake: ['Date'] });
		vi.setSystemTime(new Date('2026-10-24T10:00:00Z'));
		const { otp } = setup();
		const code = await otp.issue(EMAIL);
		vi.setSystemTime(new Date('2026-10-24T10:10:01Z'));
		expect(await otp.verify(EMAIL, code)).toEqual(REFUSED);
	});

	it('still works just inside the 600 s', async () => {
		vi.useFakeTimers({ toFake: ['Date'] });
		vi.setSystemTime(new Date('2026-10-24T10:00:00Z'));
		const { otp } = setup();
		const code = await otp.issue(EMAIL);
		vi.setSystemTime(new Date('2026-10-24T10:09:59Z'));
		expect((await otp.verify(EMAIL, code)).status).toBe(200);
	});
});

describe('verify: every refusal is the same answer', () => {
	it('a wrong code, an unknown address, no code requested and a malformed code are indistinguishable', async () => {
		const { otp, api } = setup();
		const code = await otp.issue(EMAIL);
		const answers = [
			await otp.verify(EMAIL, wrongFor(code)),
			await otp.verify('nobody@arlet.test', code),
			await otp.verify('other@arlet.test', '123456'),
			await otp.verify(EMAIL, '12345'),
			await otp.verify(EMAIL, 'abcdef'),
			await otp.verify('not an address', code),
		];
		for (const answer of answers) expect(answer).toEqual(REFUSED);
		expect(api.verify).not.toHaveBeenCalled();
	});

	it('a code that is not 6 digits is refused before any GoTrue lookup', async () => {
		const { otp, api } = setup();
		await otp.issue(EMAIL);
		api.findUserByEmail.mockClear();
		await otp.verify(EMAIL, '1234567');
		await otp.verify(EMAIL, 123456 as unknown as string);
		expect(api.findUserByEmail).not.toHaveBeenCalled();
	});

	it('refuses when the user vanished or lost confirmation between the code and the check', async () => {
		const state = { user: USER as typeof USER | null };
		const { otp, api } = setup({ findUserByEmail: async () => state.user });
		const code = await otp.issue(EMAIL);
		state.user = null;
		expect(await otp.verify(EMAIL, code)).toEqual(REFUSED);
		expect(api.verify).not.toHaveBeenCalled();
	});

	it.each([
		['generate_link fails', { generateLink: async () => ({ ok: false, status: 500, body: {} }) }],
		['generate_link has no hashed_token', { generateLink: async () => ok({}) }],
		['verify fails', { verify: async () => ({ ok: false, status: 401, body: {} }) }],
		['verify answers no access token', { verify: async () => ok({ user: { email: EMAIL } }) }],
		['verify answers a session for another address', { verify: async () => ok({ access_token: 'at', user: { email: 'mallory@arlet.test' } }) }],
	])('refuses when %s', async (_label, overrides) => {
		const { otp } = setup(overrides as Parameters<typeof fakeGotrue>[0]);
		const code = await otp.issue(EMAIL);
		expect(await otp.verify(EMAIL, code)).toEqual(REFUSED);
	});

	it('refuses everything when there is no signing key', async () => {
		const { otp } = setup({}, '');
		expect(await otp.verify(EMAIL, '123456')).toEqual(REFUSED);
	});
});

describe('attempt caps', () => {
	it('the 5th attempt can still succeed', async () => {
		const { otp } = setup();
		const code = await otp.issue(EMAIL);
		for (let i = 0; i < 4; i += 1) expect((await otp.verify(EMAIL, wrongFor(code))).status).toBe(401);
		expect((await otp.verify(EMAIL, code)).status).toBe(200);
	});

	it('after 5 wrong guesses the right code is refused too (the code is deleted)', async () => {
		const { otp, store } = setup();
		const code = await otp.issue(EMAIL);
		for (let i = 0; i < 5; i += 1) await otp.verify(EMAIL, wrongFor(code));
		expect(await otp.verify(EMAIL, code)).toEqual(REFUSED);
		expect([...(store as any).map.keys()].some((key: string) => key.startsWith('signin-code:') && !key.includes(':addr:') && !key.includes(':tries:') && !key.includes(':used:'))).toBe(false);
	});

	it('counts the attempt before it compares: the right code as the attempt past the address cap is refused', async () => {
		const { otp } = setup();
		const first = await otp.issue(EMAIL);
		for (let i = 0; i < 5; i += 1) await otp.verify(EMAIL, wrongFor(first));
		const second = await otp.issue(EMAIL);
		expect(await otp.verify(EMAIL, second)).toEqual(REFUSED);
	});

	it('a new request replaces the live code and gives its own 5 tries, but not more address tries', async () => {
		const { otp } = setup();
		const first = await otp.issue(EMAIL);
		for (let i = 0; i < 3; i += 1) await otp.verify(EMAIL, wrongFor(first));
		const second = await otp.issue(EMAIL);
		expect(await otp.verify(EMAIL, first === second ? wrongFor(second) : first)).toEqual(REFUSED);
		expect((await otp.verify(EMAIL, second)).status).toBe(200);
	});

	it('a wrong guess on another address does not spend this address\'s tries', async () => {
		const { otp } = setup();
		const code = await otp.issue(EMAIL);
		for (let i = 0; i < 8; i += 1) await otp.verify('other@arlet.test', '123456');
		expect((await otp.verify(EMAIL, code)).status).toBe(200);
	});
});

describe('the code stays out of every trace', () => {
	it('is not in any audit record, refusal body or success body', async () => {
		const { otp, audit } = setup();
		const code = await otp.issue(EMAIL);
		const wrong = await otp.verify(EMAIL, wrongFor(code));
		const right = await otp.verify(EMAIL, code);
		expect(JSON.stringify([audit.mock.calls, wrong, right])).not.toContain(code);
		expect(audit.mock.calls.map((call) => call[0])).toContain('signin_code_verified');
	});
});

describe('the address guess budget outlives the code', () => {
	const T0 = '2026-10-24T10:00:00Z';
	const at = (seconds: number) => vi.setSystemTime(new Date(Date.parse(T0) + seconds * 1000));

	async function lockAddress() {
		vi.useFakeTimers({ toFake: ['Date'] });
		at(0);
		const ctx = setup();
		const first = await ctx.otp.issue(EMAIL);
		for (let i = 0; i < 5; i += 1) await ctx.otp.verify(EMAIL, wrongFor(first));
		return ctx;
	}

	it('a new code 601 s later does not reset it: guesses 6-10 are refused without a comparison', async () => {
		const { otp } = await lockAddress();
		at(601);
		const second = await otp.issue(EMAIL);
		vi.mocked(custody.sameCode).mockClear();
		for (let i = 0; i < 4; i += 1) expect(await otp.verify(EMAIL, wrongFor(second))).toEqual(REFUSED);
		expect(await otp.verify(EMAIL, second)).toEqual(REFUSED);
		expect(custody.sameCode).not.toHaveBeenCalled();
	});

	it('is back after 3601 s', async () => {
		const { otp } = await lockAddress();
		at(3601);
		const third = await otp.issue(EMAIL);
		expect((await otp.verify(EMAIL, third)).status).toBe(200);
	});
});

describe('verify costs the same whether or not a code is pending', () => {
	async function cost(email: string, requestCode: boolean) {
		const { otp, store } = setup();
		const code = requestCode ? await otp.issue(EMAIL) : '000000';
		const calls = { get: vi.spyOn(store, 'get'), set: vi.spyOn(store, 'set'), del: vi.spyOn(store, 'del'), incr: vi.spyOn(store, 'incrWithTtl') };
		vi.mocked(custody.hashCode).mockClear();
		const answer = await otp.verify(email, wrongFor(code));
		expect(answer).toEqual(REFUSED);
		const counts = Object.values(calls).map((spy) => spy.mock.calls.length);
		return { counts, hashes: vi.mocked(custody.hashCode).mock.calls.length };
	}

	it('an unknown address, a known one without a code and a wrong guess on a live code do the same work', async () => {
		const unknown = await cost('nobody@arlet.test', false);
		const noCode = await cost(EMAIL, false);
		const wrong = await cost(EMAIL, true);
		expect(wrong.hashes).toBe(1);
		expect(unknown).toEqual(wrong);
		expect(noCode).toEqual(wrong);
	});

	it('the no-code path does not spend the address\'s real guess budget', async () => {
		const { otp } = setup();
		for (let i = 0; i < 8; i += 1) await otp.verify(EMAIL, '123456');
		const code = await otp.issue(EMAIL);
		expect((await otp.verify(EMAIL, code)).status).toBe(200);
	});
});
