/* ==========================================================================
 * build-vault.mjs — render vault/*.xmd → the static docs site under public/docs
 *
 * Uses the project's OWN markengine (parse + renderHtml) — the same parser that
 * powers the osionos editor — bundled with esbuild and evaluated in Node. Walks
 * vault/ at any depth, renders each .xmd, and writes one page per doc
 * (scripts/vault-page.mjs) plus the files they share: shell.css, shell.js and
 * vault-index.js (titles and headings, for the search palette). public/docs is
 * generated whole: it is emptied first, then vault/assets is copied in.
 *
 * Docker-only (no host node): from apps/opposite-osiris,
 *   ../../scripts/tools.sh node scripts/build-vault.mjs
 * ========================================================================== */
import { readFileSync, writeFileSync, mkdirSync, readdirSync, statSync, existsSync, cpSync, rmSync } from "node:fs";
import { join, dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import vm from "node:vm";
import { rewriteDocLinks } from "./vault-links.mjs";
import { docHref, docPage, labelTaskItems } from "./vault-page.mjs";

const require = createRequire(import.meta.url);
const HERE = dirname(fileURLToPath(import.meta.url));            // apps/opposite-osiris/scripts
const SITE = resolve(HERE, "..");                               // apps/opposite-osiris
const VAULT = join(SITE, "vault");
const OUT_DIR = join(SITE, "public", "docs");
// osionos's markdown engine, a submodule of the app since it left src/shared/lib/markengine.
const MARKDOWN_DIR = resolve(SITE, "..", "osionos", "app", "packages", "markdown-engine", "markdown");

/* ── 1. Load the markengine (parse + renderHtml) via esbuild + vm ─────────── */
async function loadMarkengine() {
  if (!existsSync(join(MARKDOWN_DIR, "parser.ts"))) {
    throw new Error(`osionos's markdown engine is not checked out at ${MARKDOWN_DIR}; from the groot root run: git -C apps/osionos/app submodule update --init packages/markdown-engine`);
  }
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
  const hrefOf = (path) => docHref(path, home.path);
  const knownDocs = new Set(docs.map((d) => d.path));
  const broken = [];
  for (const d of docs) {
    const result = rewriteDocLinks(d.html, d.path, knownDocs, hrefOf);
    // Pages sit at different depths, so an image's relative assets/ path is made absolute.
    d.html = labelTaskItems(result.html.replace(/\bsrc="assets\//g, 'src="/docs/assets/'));
    broken.push(...result.broken);
  }
  if (broken.length) throw new Error("links to docs that do not exist:\n  " + broken.join("\n  "));

  const totalHeadings = docs.reduce((n, d) => n + d.toc.length, 0);
  const site = {
    home: home.path,
    nodes: buildTree(docs),
    stats: [
      { n: String(docs.length), label: "documents" },
      { n: "17", label: "block types" },
      { n: "19", label: "inline styles" },
      { n: String(totalHeadings), label: "sections" },
    ],
  };
  const index = {
    home: home.path,
    order: docs.map((d) => d.path),
    docs: Object.fromEntries(docs.map((d) => [d.path, { title: d.title, icon: d.icon, toc: d.toc }])),
  };

  rmSync(OUT_DIR, { recursive: true, force: true });
  mkdirSync(OUT_DIR, { recursive: true });
  const ASSETS_SRC = join(VAULT, "assets");
  if (existsSync(ASSETS_SRC)) cpSync(ASSETS_SRC, join(OUT_DIR, "assets"), { recursive: true });
  cpSync(join(HERE, "vault-shell.css"), join(OUT_DIR, "shell.css"));
  cpSync(join(HERE, "vault-shell.js"), join(OUT_DIR, "shell.js"));
  writeFileSync(join(OUT_DIR, "vault-index.js"), `window.__VAULT=${JSON.stringify(index)};\n`);

  let largest = { path: "", bytes: 0 };
  for (const d of docs) {
    const dir = d === home ? OUT_DIR : join(OUT_DIR, d.path);
    mkdirSync(dir, { recursive: true });
    const html = docPage(d, site);
    writeFileSync(join(dir, "index.html"), html);
    if (html.length > largest.bytes) largest = { path: d.path, bytes: html.length };
  }
  console.log(`✓ vault → ${relative(process.cwd(), OUT_DIR)}  (${docs.length} pages; largest ${largest.path}, ${(largest.bytes / 1024).toFixed(0)} KB)`);
}

main().catch((e) => { console.error("✗ build-vault failed:\n", e); process.exit(1); });
