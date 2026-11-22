// @vitest-environment node
// The one derivation of an account's sign-in lockout keys. /login and /verify-password both read
// it, so a lock set by one is seen by the other (verify-password ruling VP6).
import { describe, expect, it } from 'vitest';
import { keyHash, loginLockKeys } from '../../../scripts/auth/identity.mjs';

describe('loginLockKeys', () => {
	it('keys the lock and the failure count on the hash of the normalised address', () => {
		const hashed = keyHash('ana@arlet.test');
		expect(loginLockKeys('ana@arlet.test')).toEqual({ lock: `lock:login:${hashed}`, fail: `fail:login:${hashed}` });
	});

	it('is the same account whatever the case or surrounding spaces', () => {
		expect(loginLockKeys('  Ana@Arlet.TEST ')).toEqual(loginLockKeys('ana@arlet.test'));
	});

	it('never puts the address itself in a key', () => {
		const { lock, fail } = loginLockKeys('ana@arlet.test');
		expect(`${lock}${fail}`).not.toContain('ana');
	});
});
