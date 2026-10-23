// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { collectStartupViolations } from '../../../scripts/auth/guards.mjs';

const secureProd = {
	siteUrl: 'https://prismatica.example',
	turnstileBypassLocal: false,
	requireEmailVerification: true,
	turnstileSecret: 'turnstile',
	trustedProxyHops: 2,
	serviceKey: 'service',
	linkSigningKeyProblem: null,
	signupAllowlist: 'ines@arlet.test, @corp.example',
};

describe('AUTH_SIGNUP_ALLOWLIST at startup (SGN-1)', () => {
	it.each([[undefined], [''], [' , \n']])('refuses a public https origin whose allowlist is %j', (signupAllowlist) => {
		const violations = collectStartupViolations({ ...secureProd, signupAllowlist });
		expect(violations).toHaveLength(1);
		expect(violations[0]).toMatch(/AUTH_SIGNUP_ALLOWLIST/);
	});

	it('is not relaxed by AUTH_DEMO_INSECURE', () => {
		expect(collectStartupViolations({ ...secureProd, demoInsecure: true, signupAllowlist: '' })).toHaveLength(1);
	});

	it('boots a public origin with a list', () => {
		expect(collectStartupViolations(secureProd)).toEqual([]);
	});

	it('leaves localhost with an empty list bootable (everyone allowed)', () => {
		expect(collectStartupViolations({ ...secureProd, siteUrl: 'https://localhost:4322', signupAllowlist: '' })).toEqual([]);
		expect(collectStartupViolations({ ...secureProd, siteUrl: 'http://localhost:4322', signupAllowlist: '' })).toEqual([]);
	});
});
