import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('robots.txt endpoint', () => {
	const source = fs.readFileSync(path.resolve(process.cwd(), 'src/pages/robots.txt.ts'), 'utf-8');

	it('is prerendered and derives Sitemap from the Astro site origin', () => {
		expect(source).toContain('export const prerender = true');
		expect(source).toContain('Sitemap:');
		expect(source).toContain('site');
		expect(source).toContain('sitemap-index.xml');
	});

	it('does not hardcode the production Sitemap to localhost:4322', () => {
		expect(source).not.toMatch(/Sitemap:\s*https:\/\/localhost:4322/);
	});

	it('keeps auth and newsletter disallows', () => {
		expect(source).toContain('Disallow: /auth/');
		expect(source).toContain('Disallow: /newsletter/');
	});
});
