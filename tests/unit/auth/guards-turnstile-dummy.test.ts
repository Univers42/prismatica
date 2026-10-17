// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { collectStartupViolations } from '../../../scripts/auth/guards.mjs';

const secureProd = {
	siteUrl: 'https://prismatica.example',
	turnstileBypassLocal: false,
	requireEmailVerification: true,
	turnstileSecret: '0x4AAAAAAAb3Kq9ZxWvLm2N8pQrStUvWxYz',
	trustedProxyHops: 2,
	serviceKey: 'service',
	linkSigningKeyProblem: null,
	signupAllowlist: '@prismatica.example',
};

const dummySecrets = [
	'1x0000000000000000000000000000000AA',
	'2x0000000000000000000000000000000AA',
	'3x0000000000000000000000000000000AA',
];

describe('Cloudflare dummy Turnstile secrets at startup', () => {
	it.each(dummySecrets)('refuses %s on a public https origin', (turnstileSecret) => {
		const violations = collectStartupViolations({ ...secureProd, turnstileSecret });
		expect(violations).toHaveLength(1);
		expect(violations[0]).toMatch(/dummy test key.*dash\.cloudflare\.com/);
	});

	it('boots with a real-shaped secret', () => {
		expect(collectStartupViolations(secureProd)).toEqual([]);
	});

	it('leaves a local origin alone', () => {
		expect(collectStartupViolations({ ...secureProd, siteUrl: 'https://localhost:4322', turnstileSecret: dummySecrets[0] })).toEqual([]);
	});

	it('is skipped under AUTH_DEMO_INSECURE like the other Turnstile checks', () => {
		expect(collectStartupViolations({ ...secureProd, demoInsecure: true, turnstileSecret: dummySecrets[0] })).toEqual([]);
	});
});
