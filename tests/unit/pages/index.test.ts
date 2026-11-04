import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { NAV } from '../../../src/data/links';

// Every in-page link of the header and footer (NAV's "/#id" entries) lands on a section that the
// home page actually renders: the id must appear in index.astro or a component it imports.
const pages = join(process.cwd(), 'src/pages');
const index = readFileSync(join(pages, 'index.astro'), 'utf-8');
const imported = [...index.matchAll(/import \w+ from '(\.\.\/components\/[^']+\.astro)'/g)].map(([, path]) => readFileSync(join(pages, path!), 'utf-8'));
const rendered = [index, ...imported].join('\n');

describe('home page anchors', () => {
	const anchors = NAV.map((item) => item.href).filter((href) => href.startsWith('/#')).map((href) => href.slice(2));

	it('has in-page navigation to check', () => {
		expect(anchors.length).toBeGreaterThan(0);
	});

	it.each(anchors)('renders a section with id "%s"', (id) => {
		expect(rendered).toContain(`id="${id}"`);
	});

	it('renders exactly one h1 across the page and its sections', () => {
		expect(rendered.match(/<h1\b/g)).toHaveLength(1);
	});
});
