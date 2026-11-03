import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// The marketing origin proxies the auth gateway and the newsletter, nothing else. /auth, /query
// and /storage once forwarded the whole BaaS here, GoTrue's /auth/v1/admin/users included,
// while no page called them (#53: 0 of 75 requests on a live load and sign-in, 2026-11-03).
const vercel = JSON.parse(readFileSync(resolve(process.cwd(), 'vercel.json'), 'utf8')) as {
	rewrites: { source: string; destination: string }[];
};

describe('vercel.json rewrites', () => {
	it('forward only the auth gateway and the newsletter', () => {
		expect(vercel.rewrites.map((rewrite) => rewrite.source)).toEqual(['/api/auth/:path*', '/api/newsletter/:path*']);
	});

	it('forward each to the same path on the gateway', () => {
		for (const { source, destination } of vercel.rewrites) {
			expect(destination.endsWith(source)).toBe(true);
		}
	});
});
