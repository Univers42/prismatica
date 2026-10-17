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

	it('tells an unconfirmed email apart by GoTrue error_code, which is only sent after a correct password', () => {
		expect(classifyLoginFailure(400, { error_code: 'email_not_confirmed', msg: 'Email not confirmed' })).toBe('unconfirmed');
		expect(classifyLoginFailure(400, { error_code: 'invalid_credentials', msg: 'Invalid login credentials' })).toBe('credentials');
	});

	it('falls back to the message when error_code is absent', () => {
		expect(classifyLoginFailure(400, { msg: 'Email not confirmed' })).toBe('unconfirmed');
		expect(classifyLoginFailure(400, { message: 'email not confirmed' })).toBe('unconfirmed');
	});

	it('ignores an unconfirmed marker on a status that is not a password-grant answer', () => {
		expect(classifyLoginFailure(502, { error_code: 'email_not_confirmed' })).toBe('upstream');
		expect(classifyLoginFailure(429, { error_code: 'email_not_confirmed' })).toBe('rate-limited');
	});

	it('copes with a missing or non-object body', () => {
		expect(classifyLoginFailure(400)).toBe('credentials');
		expect(classifyLoginFailure(400, null as never)).toBe('credentials');
	});
});
