// Cross-doc links in the vault (`[text](other.xmd)`, `../platform/x.xmd#anchor`) become links to
// that doc in the shell. The engine emits them bare (`href="x.xmd"`, which 404s) or, since it moved
// to packages/markdown-engine, as `href="https://x.xmd" target="_blank"` when the path has no slash.
//
// Caveat: this reads rendered HTML with a regex. A raw `>` in an attribute before href hides that
// link, which silently stays a .xmd href. An external site whose whole host is `<name>.xmd` (no
// other dot, no path) is taken for a sibling doc, which fails the build; write it with a path.
const DOC_LINK = /<a\b([^>]*?)\shref="(?:https?:\/\/(?=[^"/.]+\.xmd[#"])|(?!\/))([^"#?:]+?)\.xmd(?:#[^"]*)?"([^>]*)>/g;

function resolvePath(fromDoc, target) {
	const parts = fromDoc.split('/').slice(0, -1);
	for (const segment of target.split('/')) {
		if (segment === '..') parts.pop();
		else if (segment !== '.' && segment !== '') parts.push(segment);
	}
	return parts.join('/');
}

function withoutNewTab(attributes) {
	return attributes.replace(/\s+target="_blank"/g, '').replace(/\s+rel="noopener noreferrer"/g, '');
}

// The #fragment is dropped: the shell routes on the whole hash, so `#doc#anchor` opens the home doc.
export function rewriteDocLinks(html, fromDoc, knownDocs, hrefOf) {
	const broken = [];
	const rewritten = html.replace(DOC_LINK, (match, before, target, after) => {
		const path = resolvePath(fromDoc, target);
		if (!knownDocs.has(path)) {
			broken.push(`${fromDoc} → ${target}.xmd`);
			return match;
		}
		return `<a${withoutNewTab(before)} href="${hrefOf(path)}"${withoutNewTab(after)}>`;
	});
	return { html: rewritten, broken };
}

export function rewriteVaultLinks(docs, hrefOf) {
	const knownDocs = new Set(docs.map((doc) => doc.path));
	const broken = [];
	for (const doc of docs) {
		const result = rewriteDocLinks(doc.html, doc.path, knownDocs, hrefOf);
		doc.html = result.html;
		broken.push(...result.broken);
	}
	if (broken.length) throw new Error(`links to docs that do not exist:\n  ${broken.join('\n  ')}`);
}
