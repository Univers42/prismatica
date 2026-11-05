import { describe, expect, it } from 'vitest';
import { rewriteDocLinks, rewriteVaultLinks } from '../../../scripts/vault-links.mjs';

const known = new Set(['00-welcome', 'guides/architecture', 'guides/getting-started', 'reference/markengine']);
const hrefOf = (path) => `#${path}`;
const rewrite = (html, fromDoc = 'guides/getting-started') => rewriteDocLinks(html, fromDoc, known, hrefOf);

describe('rewriteDocLinks', () => {
	it('points a plain sibling link at the doc in the shell', () => {
		expect(rewrite('<a href="architecture.xmd">Architecture</a>')).toEqual({
			html: '<a href="#guides/architecture">Architecture</a>',
			broken: [],
		});
	});

	it('resolves a ../ path from a nested doc', () => {
		expect(rewrite('<a href="../reference/markengine.xmd">engine</a>', 'guides/architecture').html).toBe(
			'<a href="#reference/markengine">engine</a>',
		);
	});

	it('resolves a path from a top-level doc', () => {
		expect(rewrite('<a href="reference/markengine.xmd">engine</a>', '00-welcome').html).toBe(
			'<a href="#reference/markengine">engine</a>',
		);
	});

	it('drops a #fragment, which the shell would read as an unknown doc', () => {
		expect(rewrite('<a href="architecture.xmd#planes">planes</a>').html).toBe('<a href="#guides/architecture">planes</a>');
	});

	it('keeps the other attributes of a rewritten link', () => {
		expect(rewrite('<a class="md-link" href="architecture.xmd" title="Go">x</a>').html).toBe(
			'<a class="md-link" href="#guides/architecture" title="Go">x</a>',
		);
	});

	it('undoes the https:// and new tab the current engine adds to a sibling link', () => {
		expect(
			rewrite('<a href="https://architecture.xmd#planes" target="_blank" rel="noopener noreferrer">x</a>').html,
		).toBe('<a href="#guides/architecture">x</a>');
	});

	it.each([
		'https://example.com/page',
		'https://github.com/Univers42/prismatica/blob/main/vault/guides/architecture.xmd',
		'https://example.com/architecture.xmd#planes',
		'https://docs.example.xmd',
		'https://architecture.xmd/more.xmd',
		'http://example.com/architecture.xmd',
		'//example.com/architecture.xmd',
		'mailto:team@example.xmd',
	])('leaves the external link %s alone', (href) => {
		const source = `<a href="${href}" target="_blank" rel="noopener noreferrer">site</a>`;
		expect(rewrite(source)).toEqual({ html: source, broken: [] });
	});

	it('ignores an attribute that only ends in href', () => {
		const source = '<a data-href="architecture.xmd">x</a>';
		expect(rewrite(source)).toEqual({ html: source, broken: [] });
	});

	it('leaves escaped sample markup in a code block alone', () => {
		const source = '<code>&lt;a href=&quot;architecture.xmd&quot;&gt;</code>';
		expect(rewrite(source)).toEqual({ html: source, broken: [] });
	});

	it('reports a link to a missing doc and leaves it untouched', () => {
		const source = '<a href="../no-such/doc.xmd#anchor">x</a>';
		expect(rewrite(source)).toEqual({
			html: source,
			broken: ['guides/getting-started → ../no-such/doc.xmd'],
		});
	});
});

describe('rewriteVaultLinks', () => {
	const doc = (path, html) => ({ path, html });

	it('rewrites every doc in place', () => {
		const docs = [doc('guides/a', '<a href="b.xmd">b</a>'), doc('guides/b', '<a href="a.xmd">a</a>')];
		rewriteVaultLinks(docs, hrefOf);
		expect(docs.map((entry) => entry.html)).toEqual(['<a href="#guides/b">b</a>', '<a href="#guides/a">a</a>']);
	});

	it('fails the build on a missing target and names every one', () => {
		const docs = [doc('guides/a', '<a href="gone.xmd">x</a>'), doc('guides/b', '<a href="../lost.xmd">y</a>')];
		expect(() => rewriteVaultLinks(docs, hrefOf)).toThrow(
			'links to docs that do not exist:\n  guides/a → gone.xmd\n  guides/b → ../lost.xmd',
		);
	});
});
