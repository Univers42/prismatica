import { describe, expect, it } from 'vitest';
import type { CallbackProblem } from '../../../src/scripts/auth-callback';
import { callbackCopy, credentialResetCopy } from '../../../src/scripts/auth-callback-copy';

const PROBLEMS: CallbackProblem[] = ['cancelled', 'email_in_use', 'email_unverified', 'expired', 'rate_limited', 'unavailable', 'password_only', 'service_down', 'redirect_blocked', 'mfa_account', 'link_unfinished', 'failed'];

describe('callbackCopy', () => {
	it('gives every problem a title, an explanation, at least one next step and an action', () => {
		for (const problem of PROBLEMS) {
			const copy = callbackCopy(problem, 'github');
			expect(copy.title, problem).not.toBe('');
			expect(copy.message, problem).not.toBe('');
			expect(copy.steps.length, problem).toBeGreaterThan(0);
			expect(copy.action, problem).not.toBe('');
		}
	});

	it('names the provider the flow started with, or a neutral word when it is unknown', () => {
		expect(callbackCopy('cancelled', 'github').message).toContain('GitHub');
		expect(callbackCopy('cancelled', null).message).toContain('your provider');
	});

	it('tells a user whose password a provider sign-in removed how to get one back', () => {
		const copy = credentialResetCopy('github');
		expect(copy.tone).toBe('success');
		expect(copy.message).toContain('password was removed');
		expect(copy.message).toContain('GitHub');
		expect(copy.steps.join(' ')).toContain('Forgot password');
	});

	it('sends an email collision to password sign-in, not to another provider attempt', () => {
		expect(callbackCopy('email_in_use', 'google').action).toBe('Sign in with email');
	});
});
