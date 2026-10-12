import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';

// /docs/ is the vault docs app in public/docs/ (#48); an Astro page there would build to the
// same dist/docs/index.html, which is why src/pages/docs.astro is gone.
describe('Docs Page', () => {
	const docsApp = fs.readFileSync(path.join(process.cwd(), 'public/docs/index.html'), 'utf-8');

	it('does not contain the temporary placeholder and shows real technical content', () => {
		expect(docsApp).not.toContain('currently being written');
		expect(docsApp).toContain('<title>Prismatica Docs</title>');
		expect(docsApp).toContain('Architecture');
	});

	it('holds every anchor the old /docs/* links redirect to', () => {
		const config = fs.readFileSync(path.join(process.cwd(), 'astro.config.mjs'), 'utf-8');
		const anchors = [...config.matchAll(/'\/docs\/#([^']+)'/g)].map((match) => match[1]);
		expect(anchors.length).toBeGreaterThan(0);
		for (const anchor of anchors) {
			expect(docsApp).toContain(anchor);
		}
	});
});
