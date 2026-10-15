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
};

describe('AUTH_LINK_SIGNING_KEY at startup (C1)', () => {
	it('refuses a public https origin whose signing key is missing, short or reused', () => {
		const violations = collectStartupViolations({ ...secureProd, linkSigningKeyProblem: 'AUTH_LINK_SIGNING_KEY is not set: e-mail links cannot be signed.' });
		expect(violations).toHaveLength(1);
		expect(violations[0]).toMatch(/AUTH_LINK_SIGNING_KEY is not set/);
	});

	it('boots a public https origin with a dedicated key', () => {
		expect(collectStartupViolations(secureProd)).toEqual([]);
	});

	it('leaves a local origin bootable without a key (its link endpoints answer 503 instead)', () => {
		expect(collectStartupViolations({ ...secureProd, siteUrl: 'https://localhost:4322', linkSigningKeyProblem: 'missing' })).toEqual([]);
	});

	it('is not relaxed by AUTH_DEMO_INSECURE', () => {
		expect(collectStartupViolations({ ...secureProd, demoInsecure: true, linkSigningKeyProblem: 'missing' })).toHaveLength(1);
	});
});
