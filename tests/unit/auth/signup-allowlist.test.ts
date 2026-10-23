// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { isSignupAllowed, parseSignupAllowlist } from '../../../scripts/auth/signup-allowlist.mjs';

const allowed = (raw: string, email: string) => isSignupAllowed(parseSignupAllowlist(raw), email);

describe('parseSignupAllowlist', () => {
	it('splits on commas and any whitespace and lowercases', () => {
		const list = parseSignupAllowlist(' Ines@Arlet.Test,\n@Corp.Example  school.example ,, ');
		expect([...list.addresses]).toEqual(['ines@arlet.test']);
		expect([...list.domains].sort()).toEqual(['corp.example', 'school.example']);
		expect(list.isEmpty).toBe(false);
	});

	it.each([[undefined], [''], ['  , \n'], ['@']])('is empty for %j', (raw) => {
		expect(parseSignupAllowlist(raw).isEmpty).toBe(true);
	});
});

describe('isSignupAllowed', () => {
	it('admits an exact address and only that address', () => {
		expect(allowed('a.b@x.com', 'a.b@x.com')).toBe(true);
		expect(allowed('a.b@x.com', ' A.B@X.COM ')).toBe(true);
		expect(allowed('a.b@x.com', 'c@x.com')).toBe(false);
		expect(allowed('a.b@x.com', 'a.b+tag@x.com')).toBe(false);
	});

	it.each([['@x.com'], ['x.com']])('admits a whole domain written %s, not its subdomains or lookalikes', (entry) => {
		expect(allowed(entry, 'anyone@x.com')).toBe(true);
		expect(allowed(entry, 'anyone@mail.x.com')).toBe(false);
		expect(allowed(entry, 'anyone@notx.com')).toBe(false);
		expect(allowed(entry, 'anyone@x.com.evil.test')).toBe(false);
		expect(allowed(entry, 'x.com@evil.test')).toBe(false);
	});

	it('admits everyone when the list is empty (local dev; guards.mjs forbids this in production)', () => {
		expect(allowed('', 'anyone@anywhere.test')).toBe(true);
	});

	it('refuses an address that has no domain part once a list exists', () => {
		expect(allowed('x.com', 'x.com')).toBe(false);
	});
});
