import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// The marketing origin proxies the auth gateway, the newsletter and GoTrue's two provider
// redirects, nothing else. /auth, /query and /storage once forwarded the whole BaaS here,
// GoTrue's /auth/v1/admin/users included (#53). The provider flow still needs these two:
// the gateway sends the browser to <site>/auth/v1/authorize, and the GitHub and Google apps
// return to <site>/auth/v1/callback. Without them "Continue with GitHub" was a 404 (2026-11-04).
const vercel = JSON.parse(readFileSync(resolve(process.cwd(), 'vercel.json'), 'utf8')) as {
	rewrites: { source: string; destination: string }[];
};

describe('vercel.json rewrites', () => {
	it('forward only the auth gateway, the newsletter and the provider redirects', () => {
		expect(vercel.rewrites.map((rewrite) => rewrite.source)).toEqual([
			'/api/auth/:path*',
			'/api/newsletter/:path*',
			'/auth/v1/authorize',
			'/auth/v1/callback',
		]);
	});

	it('never forward a GoTrue path with a wildcard', () => {
		for (const { source } of vercel.rewrites.filter((rewrite) => rewrite.source.startsWith('/auth/'))) {
			expect(source).not.toMatch(/[:*(]/);
		}
	});

	it('forward each to the same path on the gateway', () => {
		for (const { source, destination } of vercel.rewrites) {
			expect(destination.endsWith(source)).toBe(true);
		}
	});
});
