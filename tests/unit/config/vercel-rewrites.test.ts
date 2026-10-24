// @vitest-environment node
// The site must not forward GoTrue's own code and magic-link endpoints to the BaaS: a code sign-in
// that GoTrue checks itself skips the gateway's attempt cap and Turnstile. The gateway's
// /api/auth/otp/* routes replace them.
//
// Caveat: the source is matched here by turning its one regex group into a JavaScript RegExp, not by
// Vercel's own matcher. Whether Vercel normalises `//auth/v1/otp` or a case variant before matching
// is only checked by a curl against the deployed site.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const config = JSON.parse(readFileSync(resolve(__dirname, '../../../vercel.json'), 'utf8')) as { rewrites: { source: string; destination: string }[] };
const rewrite = config.rewrites.find((entry) => entry.destination.includes('/auth/') && !entry.source.startsWith('/api/'));
const group = /^\/auth\/:path\((.*)\)$/.exec(rewrite?.source ?? '')?.[1];
const forwarded = (path: string) => new RegExp(`^/auth/(?:${group})$`).test(path);

describe('vercel.json /auth rewrite', () => {
	it('has one regex-constrained /auth rewrite to the BaaS', () => {
		expect(rewrite).toBeDefined();
		expect(group).toBeTruthy();
		expect(rewrite!.destination).toBe('https://baas.tail10f2ea.ts.net/auth/:path');
	});

	it.each(['/auth/v1/otp', '/auth/v1/otp/', '/auth/v1/magiclink', '/auth/v1/magiclink/', '/auth/v1/%6Ftp', '/auth/v1/ot%70'])('does not forward %s', (path) => {
		expect(forwarded(path)).toBe(false);
	});

	it.each(['/auth/v1/token', '/auth/v1/user', '/auth/v1/verify', '/auth/v1/signup', '/auth/v1/recover', '/auth/v1/logout', '/auth/v1/factors/abc/verify', '/auth/v1/otpx', '/auth/v1/x/otp', '/auth/approve'])('still forwards %s', (path) => {
		expect(forwarded(path)).toBe(true);
	});

	it('leaves the other rewrites alone', () => {
		expect(config.rewrites.map((entry) => entry.source)).toEqual(expect.arrayContaining(['/api/auth/:path*', '/api/newsletter/:path*', '/query/:path*', '/storage/:path*']));
	});
});
