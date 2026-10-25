import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';

// The page plus every section component it imports — where the anchor ids live.
function renderedSources(): string {
	const pagePath = path.join(process.cwd(), 'src/pages/index.astro');
	const page = fs.readFileSync(pagePath, 'utf-8');
	const imports = [...page.matchAll(/from '(\.\.\/components\/[^']+\.astro)'/gu)].map((match) => match[1] ?? '');
	return [page, ...imports.map((relative) => fs.readFileSync(path.resolve(path.dirname(pagePath), relative), 'utf-8'))].join('\n');
}

describe('Index Page Anchors', () => {
	it('defines each footer and header anchor exactly once', () => {
		const sources = renderedSources();
		for (const id of ['apps', 'product', 'pricing', 'faq']) {
			expect(sources.split(`id="${id}"`).length - 1, `id="${id}"`).toBe(1);
		}
	});
});

describe('Index Page Locale', () => {
	it('reads lang search param', () => {
		const sources = renderedSources();
		expect(sources).toContain("Astro.url.searchParams.get('lang')");
	});

	it('passes locale to Layout', () => {
		const sources = renderedSources();
		expect(sources).toContain('locale={requestedLocale}');
	});

	it('passes locale to HeaderNew', () => {
		const sources = renderedSources();
		expect(sources).toContain('locale={requestedLocale}');
	});
});