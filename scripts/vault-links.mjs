// Cross-doc links in the vault (`[text](other.xmd)`, `../platform/x.xmd#anchor`) become the docs
// shell's hash routes (`#platform/x`), whatever form the markdown engine emitted them in: bare
// (`href="x.xmd"`, which resolved to a missing /docs/x.xmd) or as an external link
// (`href="https://x.xmd" target="_blank"`, the engine since it moved to packages/markdown-engine).
// A link to a doc that does not exist is returned in `broken`, so the build can refuse it.

const DOC_LINK = /<a\b([^>]*?)\bhref="(?:https?:\/\/)?([^"#?:]+?)\.xmd(?:#[^"]*)?"([^>]*)>/g;

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

export function rewriteDocLinks(html, fromDoc, knownDocs) {
	const broken = [];
	const rewritten = html.replace(DOC_LINK, (match, before, target, after) => {
		const path = resolvePath(fromDoc, target);
		if (!knownDocs.has(path)) {
			broken.push(`${fromDoc} → ${target}.xmd`);
			return match;
		}
		return `<a${withoutNewTab(before).trimEnd()} href="#${path}"${withoutNewTab(after)}>`;
	});
	return { html: rewritten, broken };
}
