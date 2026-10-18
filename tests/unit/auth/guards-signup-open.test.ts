// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { collectStartupViolations } from '../../../scripts/auth/guards.mjs';

const openProd = {
	siteUrl: 'https://prismatica.example',
	turnstileBypassLocal: false,
	requireEmailVerification: true,
	turnstileSecret: '0x4AAAAAAAb3Kq9ZxWvLm2N8pQrStUvWxYz',
	trustedProxyHops: 2,
	serviceKey: 'service',
	linkSigningKeyProblem: null,
	signupAllowlist: '',
	signupOpen: true,
	mailDailyCap: 50,
	registerHourlyLimit: 10,
};

describe('AUTH_SIGNUP_OPEN at startup', () => {
	it('boots a public origin with an empty allowlist when every proof-of-ownership control is on', () => {
		expect(collectStartupViolations(openProd)).toEqual([]);
		expect(collectStartupViolations({ ...openProd, mailDailyCap: 1, registerHourlyLimit: 1 })).toEqual([]);
	});

	it.each([
		['verification off', { requireEmailVerification: false }, /AUTH_REQUIRE_EMAIL_VERIFICATION/],
		['AUTH_DEMO_INSECURE', { demoInsecure: true }, /AUTH_DEMO_INSECURE/],
		['an invalid link key', { linkSigningKeyProblem: 'AUTH_LINK_SIGNING_KEY is too short.' }, /AUTH_LINK_SIGNING_KEY/],
		['a cap above 50', { mailDailyCap: 51 }, /AUTH_MAIL_DAILY_CAP/],
		['the default 200 cap', { mailDailyCap: 200 }, /AUTH_MAIL_DAILY_CAP/],
		['no cap', { mailDailyCap: 0 }, /AUTH_MAIL_DAILY_CAP/],
		['an unset cap', { mailDailyCap: undefined }, /AUTH_MAIL_DAILY_CAP/],
		['the register limit off', { registerHourlyLimit: 0 }, /AUTH_REGISTER_RATE_LIMIT_PER_HOUR/],
		['an unparsable register limit', { registerHourlyLimit: Number.NaN }, /AUTH_REGISTER_RATE_LIMIT_PER_HOUR/],
		['a register limit above 10 an hour', { registerHourlyLimit: 11 }, /AUTH_REGISTER_RATE_LIMIT_PER_HOUR/],
	])('refuses %s, naming what is missing', (_label, override, pattern) => {
		const violations = collectStartupViolations({ ...openProd, ...override });
		expect(violations.some((violation) => pattern.test(violation))).toBe(true);
		expect(violations.length).toBeGreaterThan(0);
	});

	it('does not open anything without the flag: an empty allowlist is still a violation', () => {
		const violations = collectStartupViolations({ ...openProd, signupOpen: false });
		expect(violations).toHaveLength(1);
		expect(violations[0]).toMatch(/AUTH_SIGNUP_ALLOWLIST/);
	});

	it('leaves a non-empty allowlist as it is today', () => {
		expect(collectStartupViolations({ ...openProd, signupOpen: false, signupAllowlist: '@prismatica.example' })).toEqual([]);
	});

	it('does not apply on a local origin', () => {
		expect(collectStartupViolations({ ...openProd, siteUrl: 'https://localhost:4322', mailDailyCap: 0 })).toEqual([]);
	});
});

describe('AUTH_TURNSTILE_OPTIONAL at startup', () => {
	const closed = { ...openProd, signupOpen: false, signupAllowlist: '@prismatica.example', turnstileSecret: '' };

	it('refuses a missing secret by default', () => {
		expect(collectStartupViolations(closed).join()).toMatch(/TURNSTILE_SECRET_KEY/);
	});

	it('accepts a missing secret only when AUTH_TURNSTILE_OPTIONAL=true', () => {
		expect(collectStartupViolations({ ...closed, turnstileOptional: true })).toEqual([]);
	});

	it('keeps TURNSTILE_BYPASS_LOCAL a violation on a public origin', () => {
		const violations = collectStartupViolations({ ...closed, turnstileOptional: true, turnstileBypassLocal: true });
		expect(violations.join()).toMatch(/TURNSTILE_BYPASS_LOCAL/);
	});

	it('still refuses a dummy secret', () => {
		const dummy = '1x0000000000000000000000000000000AA';
		expect(collectStartupViolations({ ...closed, turnstileOptional: true, turnstileSecret: dummy }).join()).toMatch(/dummy/);
	});
});
