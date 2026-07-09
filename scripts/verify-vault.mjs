/* verify-vault.mjs — serve the generated docs/ dir and screenshot it (playwright).
 * Serves the whole dir so embedded assets/ images load. Runs in app-browser-tests:latest.
 *   docker run --rm -v <repo>:/repo -v <shots>:/shots app-browser-tests:latest \
 *     node /repo/apps/opposite-osiris/scripts/verify-vault.mjs
 */
import http from "node:http";
import { readFileSync, existsSync, statSync } from "node:fs";
import { join, extname } from "node:path";
import { createRequire } from "node:module";
const require = createRequire("/app/package.json");
const { chromium } = require("playwright");

const ROOT = "/repo/apps/opposite-osiris/public/docs";
const SHOTS = "/shots";
const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".png": "image/png", ".svg": "image/svg+xml", ".jpg": "image/jpeg", ".woff2": "font/woff2", ".ico": "image/x-icon" };

const server = http.createServer((req, res) => {
  let p = decodeURIComponent((req.url || "/").split("?")[0]);
  let file = join(ROOT, p === "/" ? "index.html" : p);
  if (!existsSync(file) || statSync(file).isDirectory()) file = join(ROOT, "index.html");
  try { res.writeHead(200, { "content-type": MIME[extname(file)] || "application/octet-stream" }); res.end(readFileSync(file)); }
  catch { res.writeHead(404); res.end("404"); }
});
await new Promise((r) => server.listen(8099, "127.0.0.1", r));

const errors = [];
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
page.on("console", (m) => { if (m.type() === "error") errors.push("console: " + m.text()); });
const base = "http://127.0.0.1:8099/";
async function shot(n, o = {}) { await page.screenshot({ path: `${SHOTS}/v-${n}.png`, ...o }); console.log("  · v-" + n); }
async function open(path) { await page.evaluate((p) => { location.hash = "#" + p; }, path); await page.waitForTimeout(700); }

await page.goto(base, { waitUntil: "networkidle" });
await page.waitForTimeout(1200);
await shot("01-home");                       // welcome + embedded app screenshot + hero stats
await open("tour"); await page.waitForTimeout(900);
await shot("02-tour", { fullPage: true });   // the photo gallery
await open("graph/smoothness-100k");
await shot("03-deep-doc", { fullPage: true }); // a deep agent-authored doc
await open("databases/charts");
await shot("04-deep-doc2", { fullPage: true });
await page.click('[data-action="theme"]'); await page.waitForTimeout(400);
await open("architecture/three-language-planes");
await shot("05-dark-doc");
await browser.close();
server.close();
console.log(errors.length ? "\n⚠ errors:\n" + errors.slice(0, 10).join("\n") : "\n✓ no page/console errors");
