import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// The 404 page renders inside the shared Layout (which brings the header and footer unless a page
// passes `bare`), stays out of the index, names itself, and offers the way home.
const content = readFileSync(join(process.cwd(), 'src/pages/404.astro'), 'utf-8');

describe('404 page', () => {
	it('uses the shared layout with its chrome', () => {
		expect(content).toMatch(/import Layout from ['"]\.\.\/layouts\/Layout\.astro['"]/);
		expect(content).toMatch(/<Layout\b[^>]*>/);
		expect(content).not.toMatch(/<Layout\b[^>]*\bbare\b/);
	});

	it('is noindex, has one h1, and links home', () => {
		expect(content).toMatch(/<Layout\b[^>]*\bnoindex\b/);
		expect(content.match(/<h1\b/g)).toHaveLength(1);
		expect(content).toContain('href="/"');
		expect(content).toMatch(/404/);
	});

	it('carries no inline style attribute (the CSP forbids them)', () => {
		expect(content).not.toMatch(/\sstyle=/);
	});
});
