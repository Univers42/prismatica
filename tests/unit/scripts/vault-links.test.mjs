import { describe, expect, it } from 'vitest';
import { rewriteDocLinks } from '../../../scripts/vault-links.mjs';

const known = new Set(['platform/security-scan-gate', 'platform/ci-workflows-overview', 'guides/getting-started']);

describe('rewriteDocLinks', () => {
	it('turns a sibling link the engine made external into the shell route, same tab', () => {
		const { html, broken } = rewriteDocLinks('<a class="md-link" href="https://security-scan-gate.xmd" target="_blank" rel="noopener noreferrer">gate</a>', 'platform/ci-workflows-overview', known);
		expect(html).toBe('<a class="md-link" href="#platform/security-scan-gate">gate</a>');
		expect(broken).toEqual([]);
	});

	it('resolves a bare relative link across folders and drops the in-doc anchor', () => {
		const { html } = rewriteDocLinks('<a href="../guides/getting-started.xmd#install">start</a>', 'platform/ci-workflows-overview', known);
		expect(html).toBe('<a href="#guides/getting-started">start</a>');
	});

	it('reports a link to a doc that does not exist and leaves it untouched', () => {
		const source = '<a href="no-such-doc.xmd">x</a>';
		const { html, broken } = rewriteDocLinks(source, 'platform/ci-workflows-overview', known);
		expect(html).toBe(source);
		expect(broken).toEqual(['platform/ci-workflows-overview → no-such-doc.xmd']);
	});

	it('leaves real external links alone', () => {
		const source = '<a href="https://example.com/page" target="_blank" rel="noopener noreferrer">site</a>';
		expect(rewriteDocLinks(source, 'platform/ci-workflows-overview', known).html).toBe(source);
	});
});
