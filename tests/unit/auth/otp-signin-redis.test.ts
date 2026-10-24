// @vitest-environment node
// The sign-in code's race guarantees against a real Redis. Skipped unless OTP_TEST_REDIS_URL is set
// (a skip is not a pass: the custody run passes it, see the P3-1-d1 verdict, condition 2).
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import * as custody from '../../../scripts/auth/code-custody.mjs';
import { createOtpSignin } from '../../../scripts/auth/otp-signin.mjs';
import { keyHash } from '../../../scripts/auth/identity.mjs';
import { RedisStore } from '../../../scripts/auth/store.mjs';
import { fakeGotrue, ok } from './fakes';

vi.mock('../../../scripts/auth/code-custody.mjs', async (importOriginal) => {
	const actual = await importOriginal<typeof import('../../../scripts/auth/code-custody.mjs')>();
	return { ...actual, sameCode: vi.fn(actual.sameCode) };
});

const URL_ENV = process.env.OTP_TEST_REDIS_URL ?? '';
const EMAIL = 'ines@arlet.test';
const USER = { id: 'u1', email: EMAIL, email_confirmed_at: '2026-10-01T00:00:00Z' };

describe.skipIf(!URL_ENV)('code sign-in against a real Redis', () => {
	let store: InstanceType<typeof RedisStore>;
	beforeAll(async () => {
		store = new RedisStore(URL_ENV, { logger: {} });
		for (let i = 0; i < 100 && !store.connected; i += 1) await new Promise((resolve) => setTimeout(resolve, 50));
		expect(store.connected).toBe(true);
	});
	afterAll(() => store.close());

	function build() {
		const { api } = fakeGotrue({
			findUserByEmail: async () => USER,
			generateLink: async () => ok({ hashed_token: 'h'.repeat(56) }),
			verify: async () => ok({ access_token: 'at', refresh_token: 'rt', user: { email: EMAIL } }),
		});
		return { otp: createOtpSignin({ store, gotrue: api, signingKey: 'redis-race-signing-key-0123456789abcdef', audit: vi.fn() }), api };
	}
	const parallel = (count: number, run: () => Promise<{ status: number }>) => Promise.all(Array.from({ length: count }, run));

	it('10 parallel verifies with the right code make exactly 1 session', async () => {
		const { otp, api } = build();
		const code = await otp.issue(EMAIL);
		const results = await parallel(10, () => otp.verify(EMAIL, code));
		expect(results.filter((result) => result.status === 200)).toHaveLength(1);
		expect(api.verify).toHaveBeenCalledTimes(1);
	});

	it('20 parallel wrong guesses reach the compare at most 5 times', async () => {
		const { otp } = build();
		await store.del(`signin-code:addr:${keyHash(EMAIL)}`);
		const code = await otp.issue(EMAIL);
		vi.mocked(custody.sameCode).mockClear();
		const wrong = code === '000000' ? '000001' : '000000';
		const results = await parallel(20, () => otp.verify(EMAIL, wrong));
		expect(results.every((result) => result.status === 401)).toBe(true);
		expect(vi.mocked(custody.sameCode).mock.calls.length).toBeLessThanOrEqual(5);
	});
});
