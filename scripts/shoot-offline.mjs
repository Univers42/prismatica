/* shoot-offline.mjs — serve the osionos OFFLINE build and screenshot real surfaces.
 * The offline bundle (VITE_ALLOW_OFFLINE_MODE) renders the real editor/graph with
 * no auth gate — the legitimate way to capture app photos. Run in app-browser-tests. */
import http from "node:http";
import { readFileSync, existsSync, statSync } from "node:fs";
import { join, extname } from "node:path";
import { createRequire } from "node:module";
const require = createRequire("/app/package.json");
const { chromium } = require("playwright");

const ROOT = "/repo/apps/osionos/app/build";
const SHOTS = "/shots";
const MIME = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp", ".woff2": "font/woff2", ".woff": "font/woff", ".json": "application/json", ".ico": "image/x-icon", ".map": "application/json" };

const server = http.createServer((req, res) => {
  let p = decodeURIComponent((req.url || "/").split("?")[0]);
  let file = join(ROOT, p);
  if (!existsSync(file) || statSync(file).isDirectory()) file = join(ROOT, "index.html"); // SPA fallback
  try {
    const body = readFileSync(file);
    res.writeHead(200, { "content-type": MIME[extname(file)] || "application/octet-stream" });
    res.end(body);
  } catch { res.writeHead(404); res.end("404"); }
});
await new Promise((r) => server.listen(4188, "127.0.0.1", r));

const browser = await chromium.launch({ args: ["--ignore-certificate-errors"] });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 880 }, deviceScaleFactor: 1 });
const page = await ctx.newPage();
const errs = [];
page.on("pageerror", (e) => errs.push(e.message));
const base = "http://127.0.0.1:4188/";

async function shot(name, url, wait = 4500, wu = "networkidle") {
  try {
    await page.goto(base + url, { waitUntil: wu, timeout: 30000 });
    await page.waitForTimeout(wait);
    await page.screenshot({ path: `${SHOTS}/off-${name}.png` });
    console.log("  · off-" + name);
  } catch (e) { console.log("  ✗ " + name + ": " + e.message); }
}

await shot("home", "", 5000);
// graph never reaches networkidle (rAF + layout worker) — use domcontentloaded + long settle
await shot("graph", "?home=graph&graphBench=1500", 12000, "domcontentloaded");
await shot("database", "?home=database", 6000);
await shot("dashboard", "?home=dashboard", 6000);
await shot("workspace", "?home=workspace", 5000);

await browser.close();
server.close();
console.log(errs.length ? "\nerrors:\n" + errs.slice(0, 6).join("\n") : "\nno page errors");
