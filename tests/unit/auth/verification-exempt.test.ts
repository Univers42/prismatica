// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { collectStartupViolations } from '../../../scripts/auth/guards.mjs';
import { isVerificationExempt, MAX_EXEMPT_ENTRIES, parseVerificationExempt, withExemptSuppression } from '../../../scripts/auth/verification-exempt.mjs';

const problems = (raw: string, loginEmailOtp = false) => parseVerificationExempt(raw, { loginEmailOtp }).problems;

describe('parseVerificationExempt', () => {
	it('lowercases, trims and splits on commas and whitespace', () => {
		const { addresses, problems: found } = parseVerificationExempt(' Dylan@Gmail.com,\n ines@arlet.test  ,, ');
		expect([...addresses]).toEqual(['dylan@gmail.com', 'ines@arlet.test']);
		expect(found).toEqual([]);
	});

	it('is empty and clean when unset', () => {
		expect(parseVerificationExempt(undefined)).toEqual({ addresses: new Set(), problems: [] });
	});

	it.each([
		['an invalid address', 'not-an-address'],
		['a bare domain wildcard', '@gmail.com'],
		['a star', '*@gmail.com'],
		['a star in the domain', 'dylan@*.com'],
		['a quoted local part', '"dylan"@gmail.com'],
	])('refuses %s, naming AUTH_VERIFICATION_EXEMPT', (_label, raw) => {
		const found = problems(raw);
		expect(found).toHaveLength(1);
		expect(found[0]).toContain('AUTH_VERIFICATION_EXEMPT');
	});

	it('allows ten entries and refuses eleven', () => {
		const list = (count: number) => Array.from({ length: count }, (_, n) => `u${n}@arlet.test`).join(',');
		expect(MAX_EXEMPT_ENTRIES).toBe(10);
		expect(problems(list(10))).toEqual([]);
		const found = problems(list(11));
		expect(found).toHaveLength(1);
		expect(found[0]).toContain('AUTH_VERIFICATION_EXEMPT');
	});

	it('refuses a non-empty list together with the emailed sign-in code, and only then', () => {
		const found = problems('dylan@gmail.com', true);
		expect(found).toHaveLength(1);
		expect(found[0]).toMatch(/AUTH_VERIFICATION_EXEMPT.*AUTH_LOGIN_EMAIL_OTP/);
		expect(problems('', true)).toEqual([]);
		expect(problems('dylan@gmail.com', false)).toEqual([]);
	});
});

describe('isVerificationExempt', () => {
	const { addresses } = parseVerificationExempt('dylan@gmail.com');
	it('matches the exact address, case-insensitively, and nothing else', () => {
		expect(isVerificationExempt(addresses, ' Dylan@Gmail.com ')).toBe(true);
		expect(isVerificationExempt(addresses, 'other@gmail.com')).toBe(false);
		expect(isVerificationExempt(addresses, 'dylan@gmail.com.evil.test')).toBe(false);
		expect(isVerificationExempt(addresses, undefined)).toBe(false);
	});
});

describe('withExemptSuppression', () => {
	const { addresses } = parseVerificationExempt('dylan@gmail.com');
	const message = { to: 'Dylan@gmail.com', subject: 's', html: '<p>secret body</p>' };

	it('calls the mailer for anyone else', async () => {
		const send = vi.fn().mockResolvedValue(undefined);
		const audit = vi.fn();
		await withExemptSuppression(addresses, send, audit)({ ...message, to: 'ines@arlet.test' });
		expect(send).toHaveBeenCalledTimes(1);
		expect(audit).not.toHaveBeenCalled();
	});

	it('skips the mailer for an exempt recipient, audits once without the body, and reports it', async () => {
		const send = vi.fn();
		const audit = vi.fn();
		const result = await withExemptSuppression(addresses, send, audit)(message);
		expect(send).not.toHaveBeenCalled();
		expect(audit).toHaveBeenCalledTimes(1);
		expect(audit).toHaveBeenCalledWith('mail_suppressed_exempt', { email: 'dylan@gmail.com' });
		expect(result).toEqual({ suppressed: true });
	});
});

describe('startup guard', () => {
	const local = { siteUrl: 'http://localhost:4322' };
	it('boots a valid list on a local origin', () => {
		expect(collectStartupViolations({ ...local, verificationExempt: 'dylan@gmail.com' })).toEqual([]);
	});

	it('refuses a bad list on a local origin too', () => {
		const violations = collectStartupViolations({ ...local, verificationExempt: '@gmail.com' });
		expect(violations).toHaveLength(1);
		expect(violations[0]).toContain('AUTH_VERIFICATION_EXEMPT');
	});

	it('refuses the emailed sign-in code with a list, on a local origin', () => {
		const violations = collectStartupViolations({ ...local, verificationExempt: 'dylan@gmail.com', loginEmailOtp: true });
		expect(violations.some((violation) => /AUTH_VERIFICATION_EXEMPT/.test(violation))).toBe(true);
	});
});
