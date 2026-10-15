import { describe, expect, it } from 'vitest';
import { describeDoc, docHref, docPage, focusableCodeBlocks, labelTaskItems } from '../../../scripts/vault-page.mjs';

const home = { path: '00-welcome', title: 'Welcome', icon: '◆', summary: 'Start here.', crumbs: ['00-welcome.xmd'], toc: [], html: '<p>Hello.</p>' };
const guide = {
	path: 'guides/getting-started',
	title: 'Getting started',
	icon: '▲',
	summary: '',
	crumbs: ['guides', 'getting-started.xmd'],
	toc: [{ id: 'install', text: 'Install', level: 2 }],
	html: '<p>Clone the <strong>repo</strong> &amp; run make.</p><h2 id="install">Install</h2>',
};
const tree = [{ type: 'file', ...home }, { type: 'dir', name: 'guides', children: [{ type: 'file', ...guide }] }];
const site = { home: home.path, nodes: tree, stats: [] };

describe('docHref', () => {
	it('gives the home doc /docs/ and every other doc its own directory', () => {
		expect(docHref('00-welcome', '00-welcome')).toBe('/docs/');
		expect(docHref('guides/getting-started', '00-welcome')).toBe('/docs/guides/getting-started/');
	});
});

describe('describeDoc', () => {
	it('prefers the summary, else the first paragraph as plain text, cut at a word under 160 chars', () => {
		expect(describeDoc(home)).toBe('Start here.');
		expect(describeDoc(guide)).toBe('Clone the repo & run make.');
		const long = { ...guide, html: `<p>${'word '.repeat(60)}</p>` };
		const text = describeDoc(long);
		expect(text.length).toBeLessThanOrEqual(160);
		expect(text.endsWith('…')).toBe(true);
	});
});

describe('docPage', () => {
	const html = docPage(guide, site);

	it('holds only its own article, with the shell assets loaded from files', () => {
		expect(html.match(/<article\b/g)).toHaveLength(1);
		expect(html).toContain('data-doc="guides/getting-started"');
		expect(html).toContain('<link rel="stylesheet" href="/docs/shell.css">');
		expect(html).toMatch(/<script src="\/docs\/shell\.js" defer><\/script>/);
		expect(html).not.toContain('window.__VAULT=');
	});

	it('names itself for search engines', () => {
		expect(html).toContain('<title>Getting started · Prismatica Docs</title>');
		expect(html).toContain('<meta name="description" content="Clone the repo &amp; run make.">');
	});

	it('marks its own row in the tree, links every row to a real page, and lists its headings', () => {
		expect(html).toMatch(/<a class="tree__row is-active" aria-current="page" data-nav="guides\/getting-started" href="\/docs\/guides\/getting-started\/">/);
		expect(html).toContain('href="/docs/"');
		expect(html).not.toMatch(/href="#(00-welcome|guides\/)/);
		expect(html).toContain('<a class="toc__link toc__link--2" href="#install" data-toc="install">Install</a>');
	});

	it('gives the home page its hero, without a second h1', () => {
		const page = docPage({ ...home, html: '<h1 id="welcome">Welcome</h1>' }, site);
		expect(page).toContain('class="hero"');
		expect(page.match(/<h1\b/g)).toHaveLength(1);
		expect(html).not.toContain('class="hero"');
	});
});

describe('labelTaskItems', () => {
	it('names each task checkbox after its item, done or not', () => {
		const html = '<ul class="md-task-list"><li class="md-task-item" data-block-state="reading"><input type="checkbox" checked disabled />Render <em>fast-path</em> &amp; docs</li>\n<li class="md-task-item"><input type="checkbox" disabled />Ship it</li></ul>';
		expect(labelTaskItems(html)).toBe('<ul class="md-task-list"><li class="md-task-item" data-block-state="reading"><input type="checkbox" checked disabled aria-label="Render fast-path &amp; docs">Render <em>fast-path</em> &amp; docs</li>\n<li class="md-task-item"><input type="checkbox" disabled aria-label="Ship it">Ship it</li></ul>');
	});
});

describe('focusableCodeBlocks', () => {
	it('lets the keyboard reach a code block that scrolls sideways, once', () => {
		const html = '<pre data-block-state="reading"><code>a</code></pre><pre tabindex="-1"><code>b</code></pre><p>pre</p>';
		const once = focusableCodeBlocks(html);
		expect(once).toBe('<pre tabindex="0" data-block-state="reading"><code>a</code></pre><pre tabindex="-1"><code>b</code></pre><p>pre</p>');
		expect(focusableCodeBlocks(once)).toBe(once);
	});
});
