// One static page per vault doc (/docs/<path>/, the first doc at /docs/): the shell, the tree,
// the doc's own article and its table of contents, all rendered here. The shell's CSS, its
// script and the search index are files every page shares, so a page carries only its doc.
// The single 2 MB page that held every doc scored 0.72 on mobile with a 20.7 s LCP (Lighthouse,
// groot docs/redesign/phase3, 2026-10-15).

export const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

export function docHref(path, home) {
	return path === home ? '/docs/' : `/docs/${path}/`;
}

const DESCRIPTION_MAX = 160;
const ENTITIES = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'" };

function plainText(html) {
	return html.replace(/<[^>]+>/g, '').replace(/&(amp|lt|gt|quot|#39);/g, (e) => ENTITIES[e]).replace(/\s+/g, ' ').trim();
}

const TASK_ITEM = /(<li class="md-task-item"[^>]*>)<input type="checkbox"([^>]*?)\s*\/?>([\s\S]*?)<\/li>/g;

// osionos's markdown engine renders a task-list checkbox with no name (renderers/html.ts,
// renderTaskListItems; axe "label"), so each one is named after its item's text here. A <label>
// around the item would be invalid once the item holds a paragraph or a nested list.
export function labelTaskItems(html) {
	return html.replace(TASK_ITEM, (match, item, attributes, inner) => `${item}<input type="checkbox"${attributes} aria-label="${esc(plainText(inner).slice(0, 120))}">${inner}</li>`);
}

// A code block scrolls sideways at phone width (\`.md pre { overflow-x: auto }\`), and a scroll
// region the keyboard cannot reach fails axe "scrollable-region-focusable" (phase6, 390 px). A
// block that already states a tabindex keeps it.
export function focusableCodeBlocks(html) {
	return html.replace(/<pre\b(?![^>]*\btabindex=)/g, '<pre tabindex="0"');
}

// Caveat: a doc whose first paragraph is a callout or a link list gets that as its description;
// give it a `summary:` in its frontmatter instead.
export function describeDoc(doc) {
	const text = doc.summary || plainText(/<p\b[^>]*>([\s\S]*?)<\/p>/.exec(doc.html)?.[1] ?? doc.title);
	if (text.length <= DESCRIPTION_MAX) return text;
	return `${text.slice(0, DESCRIPTION_MAX - 1).replace(/\s+\S*$/, '')}…`;
}

export function renderTree(nodes, home, current) {
	const row = (node) => {
		if (node.type === 'file') {
			const active = node.path === current ? ' is-active" aria-current="page' : '';
			return `<li class="tree__item tree__item--file"><a class="tree__row${active}" data-nav="${esc(node.path)}" href="${docHref(node.path, home)}"><span class="tree__caret"></span><span class="tree__glyph">${esc(node.icon || '◆')}</span><span class="tree__label">${esc(node.title)}</span></a></li>`;
		}
		return `<li class="tree__item tree__item--dir"><button class="tree__row tree__dir" aria-expanded="true"><span class="tree__caret">▸</span><span class="tree__glyph">▾</span><span class="tree__label">${esc(node.name)}<span class="tree__ext">/</span></span></button>${renderTree(node.children, home, current)}</li>`;
	};
	return `<ul class="tree__list">${nodes.map(row).join('')}</ul>`;
}

function crumbs(doc) {
	const parts = doc.crumbs.map((part, i) => `<span class="sep">/</span>${i === doc.crumbs.length - 1 ? `<b>${esc(part)}</b>` : esc(part)}`);
	return `<span class="sep">~/</span>vault${parts.join('')}`;
}

function toc(doc) {
	if (!doc.toc.length) return '';
	const items = doc.toc.map((h) => `<li><a class="toc__link toc__link--${h.level}" href="#${esc(h.id)}" data-toc="${esc(h.id)}">${esc(h.text)}</a></li>`);
	return `<div class="toc__title">On this page</div><ul class="toc__list">${items.join('')}</ul>`;
}

// The home doc opens with its own h1, so the hero's title is not a second one.
function hero(doc, stats) {
	const figures = stats.map((s) => `<div class="hero__stat"><b>${esc(s.n)}</b><span>${esc(s.label)}</span></div>`).join('');
	return `<div class="hero"><div class="hero__eyebrow">Prismatica · Track Binocle</div><p class="hero__title">${esc(doc.title)}</p><p class="hero__sub">${esc(doc.summary || '')}</p><div class="hero__stats">${figures}</div></div>`;
}

/** @param site {{ home: string, nodes: object[], stats: Array<{n: string, label: string}> }} — nodes is the vault tree */
export function docPage(doc, site) {
	const tree = renderTree(site.nodes, site.home, doc.path);
	const body = (doc.path === site.home ? hero(doc, site.stats) : '') + doc.html;
	return `<!doctype html>
<html lang="en" data-theme="solar">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="theme-color" content="#fdfaf2">
<title>${esc(doc.title)} · Prismatica Docs</title>
<meta name="description" content="${esc(describeDoc(doc))}">
<link rel="stylesheet" href="/docs/shell.css">
<script src="/docs/vault-index.js" defer></script>
<script src="/docs/shell.js" defer></script>
</head>
<body>
<div class="shell">
  <header class="shell__bar">
    <button class="shell__iconbtn shell__menu" data-action="menu" aria-label="Toggle navigation">≡</button>
    <a class="shell__brand" href="/docs/"><b>◆</b> Prismatica <span class="shell__brand-sub">docs</span></a>
    <div class="shell__prompt"><span class="u">binocle</span>@<span class="p">prismatica</span> ~/vault <span class="shell__caret">❯</span></div>
    <button class="shell__palette-trigger" data-action="palette"><span class="label">Search docs…</span><kbd>⌘K</kbd></button>
    <button class="shell__iconbtn" data-action="theme" aria-label="Toggle theme">◑</button>
  </header>
  <div class="shell__body">
    <nav class="shell__sidebar" aria-label="Documents">
      <div class="tree__root-label">▾ vault/</div>
      ${tree}
    </nav>
    <main class="shell__main" id="main">
      <nav class="crumbs" aria-label="Breadcrumb">${crumbs(doc)}</nav>
      <div class="doc-host">
        <article class="doc md" data-doc="${esc(doc.path)}">${body}</article>
      </div>
    </main>
    <aside class="shell__toc" aria-label="On this page">${toc(doc)}</aside>
  </div>
</div>
<div class="palette" hidden>
  <div class="palette__backdrop"></div>
  <div class="palette__panel">
    <input class="palette__input" placeholder="Jump to a doc or heading…" aria-label="Search the docs" spellcheck="false" autocomplete="off">
    <div class="palette__results"></div>
  </div>
</div>
</body>
</html>
`;
}
