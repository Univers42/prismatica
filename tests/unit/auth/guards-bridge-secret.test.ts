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
	signupAllowlist: '@prismatica.example',
};

describe('OSIONOS_BRIDGE_SHARED_SECRET at startup', () => {
	it.each([[' '], ['x'.repeat(31)]])('refuses a public https origin with the weak secret %j', (secret) => {
		const violations = collectStartupViolations({ ...secureProd, osionosBridgeSecret: secret });
		expect(violations).toHaveLength(1);
		expect(violations[0]).toMatch(/OSIONOS_BRIDGE_SHARED_SECRET .* 32 characters/);
	});

	it('boots with a 64-character secret, or none (the b2b public gateway runs without one)', () => {
		expect(collectStartupViolations({ ...secureProd, osionosBridgeSecret: 'x'.repeat(64) })).toEqual([]);
		expect(collectStartupViolations({ ...secureProd, osionosBridgeSecret: '' })).toEqual([]);
	});

	it('leaves a local origin bootable with a weak secret (its bridge routes answer 503)', () => {
		expect(collectStartupViolations({ ...secureProd, siteUrl: 'https://localhost:4322', osionosBridgeSecret: ' ' })).toEqual([]);
	});
});
