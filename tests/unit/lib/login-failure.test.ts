import { describe, expect, it } from 'vitest';
import { classifyLoginFailure } from '../../../scripts/auth/login-failure.mjs';

describe('classifyLoginFailure', () => {
	it('keeps GoTrue credential answers generic', () => {
		expect(classifyLoginFailure(400)).toBe('credentials');
		expect(classifyLoginFailure(422)).toBe('credentials');
	});

	it('names the rate limit', () => {
		expect(classifyLoginFailure(429)).toBe('rate-limited');
	});

	it('never reports a failure that did not check the password as wrong credentials', () => {
		for (const status of [0, 401, 403, 404, 500, 502, 503, 504]) {
			expect(classifyLoginFailure(status)).toBe('upstream');
		}
	});
});
