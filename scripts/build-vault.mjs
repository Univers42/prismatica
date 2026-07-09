/* ==========================================================================
 * build-vault.mjs — render vault/*.xmd → a self-contained shell-UI docs page
 *
 * Uses the project's OWN markengine (parse + renderHtml) — the same parser that
 * powers the osionos editor — bundled with esbuild and evaluated in Node. Walks
 * vault/ at any depth, renders each .xmd, and emits public/docs/index.html.
 *
 * Docker-only (no host node): run inside a node container, e.g.
 *   docker run --rm -v <repo>:/repo -w /repo node:22-bookworm \
 *     node apps/opposite-osiris/scripts/build-vault.mjs
 * ========================================================================== */
import { readFileSync, writeFileSync, mkdirSync, readdirSync, statSync, existsSync, cpSync } from "node:fs";
import { join, dirname, relative, resolve, extname } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import vm from "node:vm";

const require = createRequire(import.meta.url);
const HERE = dirname(fileURLToPath(import.meta.url));            // apps/opposite-osiris/scripts
const SITE = resolve(HERE, "..");                               // apps/opposite-osiris
const VAULT = join(SITE, "vault");
const OUT_DIR = join(SITE, "public", "docs");
const MARKDOWN_DIR = resolve(SITE, "..", "osionos", "app", "src", "shared", "lib", "markengine", "markdown");

/* ── 1. Load the markengine (parse + renderHtml) via esbuild + vm ─────────── */
async function loadMarkengine() {
  const esbuild = require("esbuild");
  const out = await esbuild.build({
    stdin: {
      contents: 'export { parse } from "./parser";\nexport { renderHtml } from "./renderers/html";\n',
      resolveDir: MARKDOWN_DIR,
      loader: "ts",
    },
    bundle: true, platform: "node", format: "cjs", write: false, external: ["react"],
  });
  const mod = { exports: {} };
  const localRequire = (id) => (id === "react" ? { createElement: () => ({}), Fragment: Symbol("f") } : require(id));
  vm.runInNewContext(out.outputFiles[0].text, { module: mod, exports: mod.exports, require: localRequire, console, process, Buffer, TextEncoder, TextDecoder, URL });
  return mod.exports;
}

/* ── 2. Walk vault/ recursively for .xmd files (any depth) ────────────────── */
function walk(dir) {
  const found = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) found.push(...walk(full));
    else if (name.endsWith(".xmd")) found.push(full);
  }
  return found;
}

/* ── 3. Frontmatter + heading slugs/TOC ───────────────────────────────────── */
function parseFrontmatter(raw) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(raw);
  const meta = {};
  if (!m) return { meta, body: raw };
  for (const line of m[1].split(/\r?\n/)) {
    const kv = /^(\w+):\s*(.*)$/.exec(line);
    if (kv) meta[kv[1]] = kv[2].trim();
  }
  return { meta, body: raw.slice(m[0].length) };
}
function inlineText(nodes) {
  return (nodes || []).map((n) => {
    if (n.type === "text" || n.type === "code" || n.type === "emoji" || n.type === "math_inline") return n.value || "";
    return inlineText(n.children);
  }).join("");
}
function slugify(text, seen) {
  let base = text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "section";
  let slug = base, i = 2;
  while (seen.has(slug)) slug = base + "-" + i++;
  seen.add(slug);
  return slug;
}
function assignHeadingIds(blocks) {
  const seen = new Set(), toc = [];
  const walkBlocks = (nodes) => {
    for (const b of nodes || []) {
      if (b.type === "heading") {
        const text = inlineText(b.children);
        b.id = slugify(text, seen);
        if (b.level >= 2 && b.level <= 3) toc.push({ id: b.id, text, level: b.level });
      }
      if (b.children && b.type !== "heading" && b.type !== "paragraph") walkBlocks(b.children);
    }
  };
  walkBlocks(blocks);
  return toc;
}

/* ── 4. Build the directory tree (min-order sort) ─────────────────────────── */
function buildTree(docs) {
  const root = { type: "dir", name: "", order: Infinity, kids: new Map() };
  for (const d of docs) {
    const segs = d.path.split("/");
    let node = root;
    for (let i = 0; i < segs.length - 1; i++) {
      if (!node.kids.has(segs[i])) node.kids.set(segs[i], { type: "dir", name: segs[i], order: Infinity, kids: new Map() });
      node = node.kids.get(segs[i]);
      node.order = Math.min(node.order, d.order);
    }
    node.kids.set(segs[segs.length - 1], { type: "file", ...d });
  }
  const sort = (node) => {
    const arr = [...node.kids.values()].map((k) => (k.type === "dir" ? { ...k, children: sort(k) } : k));
    arr.sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));
    return arr;
  };
  return sort(root);
}

/* ── 5. HTML assembly ─────────────────────────────────────────────────────── */
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

function renderTree(nodes) {
  return '<ul class="tree__list">' + nodes.map(renderNode).join("") + "</ul>";
}
function renderNode(n) {
  if (n.type === "file") {
    return '<li class="tree__item tree__item--file"><a class="tree__row" data-nav="' + esc(n.path) + '" href="#' + esc(n.path) +
      '"><span class="tree__caret"></span><span class="tree__glyph">' + esc(n.icon || "◆") + '</span><span class="tree__label">' + esc(n.title) + "</span></a></li>";
  }
  return '<li class="tree__item tree__item--dir"><button class="tree__row tree__dir" aria-expanded="true"><span class="tree__caret">▸</span>' +
    '<span class="tree__glyph">▾</span><span class="tree__label">' + esc(n.name) + '<span class="tree__ext">/</span></span></button>' + renderTree(n.children) + "</li>";
}
function heroHtml(home, stats) {
  return '<div class="hero"><div class="hero__eyebrow">Prismatica · Track Binocle</div>' +
    '<h1 class="hero__title">' + esc(home.title) + "</h1>" +
    '<p class="hero__sub">' + esc(home.summary || "") + "</p>" +
    '<div class="hero__stats">' + stats.map((s) => '<div class="hero__stat"><b>' + esc(s.n) + "</b><span>" + esc(s.label) + "</span></div>").join("") + "</div></div>";
}

function bodyInner(css, js, treeHtml, articles, vaultData) {
  return `<style>${css}</style>
<div class="shell">
  <header class="shell__bar">
    <button class="shell__iconbtn shell__menu" data-action="menu" aria-label="Toggle navigation">≡</button>
    <a class="shell__brand" href="#${vaultData.order[0]}"><b>◆</b> Prismatica <span class="shell__brand-sub">docs</span></a>
    <div class="shell__prompt"><span class="u">binocle</span>@<span class="p">prismatica</span> ~/vault <span class="shell__caret">❯</span></div>
    <button class="shell__palette-trigger" data-action="palette"><span class="label">Search docs…</span><kbd>⌘K</kbd></button>
    <button class="shell__iconbtn" data-action="theme" aria-label="Toggle theme">◑</button>
  </header>
  <div class="shell__body">
    <aside class="shell__sidebar">
      <div class="tree__root-label">▾ vault/</div>
      ${treeHtml}
    </aside>
    <main class="shell__main">
      <nav class="crumbs"></nav>
      <div class="doc-host">
        ${articles}
      </div>
    </main>
    <aside class="shell__toc"></aside>
  </div>
</div>
<div class="palette" hidden>
  <div class="palette__backdrop"></div>
  <div class="palette__panel">
    <input class="palette__input" placeholder="Jump to a doc or heading…" spellcheck="false" autocomplete="off" />
    <div class="palette__results"></div>
  </div>
</div>
<script>window.__VAULT=${JSON.stringify(vaultData)};</script>
<script>${js}</script>`;
}
function page(inner) {
  return `<!doctype html>
<html lang="en" data-theme="solar">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="theme-color" content="#fdfaf2" />
<base href="/docs/" />
<title>Prismatica Docs</title>
</head>
<body>
${inner}
</body>
</html>`;
}

/* ── 6. Main ──────────────────────────────────────────────────────────────── */
async function main() {
  const { parse, renderHtml } = await loadMarkengine();
  const files = walk(VAULT).sort();
  const docs = [];
  for (const file of files) {
    const rel = relative(VAULT, file).replace(/\\/g, "/");
    const path = rel.replace(/\.xmd$/, "");
    const { meta, body } = parseFrontmatter(readFileSync(file, "utf8"));
    const ast = parse(body);
    const toc = assignHeadingIds(ast);
    const html = renderHtml(ast, { classPrefix: "md", externalLinks: true });
    const segs = rel.split("/");
    docs.push({
      path,
      name: segs[segs.length - 1],
      title: meta.title || path,
      icon: meta.icon || "◆",
      summary: meta.summary || "",
      order: meta.order !== undefined ? Number(meta.order) : 999,
      crumbs: segs,
      toc, html,
    });
  }
  docs.sort((a, b) => a.order - b.order || a.path.localeCompare(b.path));
  if (!docs.length) throw new Error("No .xmd files found under " + VAULT);

  const home = docs[0];
  const totalHeadings = docs.reduce((n, d) => n + d.toc.length, 0);
  const stats = [
    { n: String(docs.length), label: "documents" },
    { n: "17", label: "block types" },
    { n: "19", label: "inline styles" },
    { n: String(totalHeadings), label: "sections" },
  ];

  const articles = docs.map((d, i) => {
    const inner = (d === home ? heroHtml(home, stats) : "") + d.html;
    return '<article class="doc md" data-doc="' + esc(d.path) + '"' + (i === 0 ? "" : " hidden") + ">" + inner + "</article>";
  }).join("\n");

  const vaultData = {
    order: docs.map((d) => d.path),
    docs: Object.fromEntries(docs.map((d) => [d.path, { title: d.title, icon: d.icon, crumbs: d.crumbs, toc: d.toc }])),
  };
  const css = readFileSync(join(HERE, "vault-shell.css"), "utf8");
  const js = readFileSync(join(HERE, "vault-shell.js"), "utf8");

  mkdirSync(OUT_DIR, { recursive: true });
  const ASSETS_SRC = join(VAULT, "assets");
  if (existsSync(ASSETS_SRC)) cpSync(ASSETS_SRC, join(OUT_DIR, "assets"), { recursive: true }); // served at /docs/assets

  const inner = bodyInner(css, js, renderTree(buildTree(docs)), articles, vaultData);
  const outFile = join(OUT_DIR, "index.html");
  writeFileSync(outFile, page(inner));

  // fragment (Artifact preview): inline embedded <img src="assets/X"> as data-URIs so
  // images render off a claude.ai host (CSP blocks external paths). Cap each at 1.2 MB.
  const fragment = inner.replace(/src="assets\/([^"]+)"/g, (m, name) => {
    try {
      const b = readFileSync(join(ASSETS_SRC, name));
      if (b.length > 1_200_000) return m;
      const ext = extname(name).slice(1).toLowerCase();
      return `src="data:image/${ext === "jpg" ? "jpeg" : ext};base64,${b.toString("base64")}"`;
    } catch { return m; }
  });
  writeFileSync(join(OUT_DIR, "fragment.html"), fragment);
  const bytes = statSync(outFile).size;
  console.log(`✓ vault → ${relative(process.cwd(), outFile)}  (${docs.length} docs, ${(bytes / 1024).toFixed(0)} KB)`);
  for (const d of docs) console.log(`   · ${d.path}  “${d.title}”  ${d.toc.length} headings`);
}

main().catch((e) => { console.error("✗ build-vault failed:\n", e); process.exit(1); });
