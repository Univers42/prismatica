/* capture-app.mjs — authenticated screenshot pass over the running stack.
 * Website (warm-editorial marketing) + sign-in → osionos app surfaces.
 * Run in app-browser-tests:latest with --network host.
 *   EMAIL=… PASSWORD=… docker run --network host … node …/capture-app.mjs
 */
import { createRequire } from "node:module";
const require = createRequire("/app/package.json");
const { chromium } = require("playwright");

const SHOTS = "/shots";
const EMAIL = process.env.EMAIL || "";
const PASSWORD = process.env.PASSWORD || "";
const log = (...a) => console.log(...a);

const browser = await chromium.launch({ args: ["--ignore-certificate-errors"] });
const ctx = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));

async function shot(name, opts = {}) { try { await page.screenshot({ path: `${SHOTS}/${name}.png`, ...opts }); log("  · " + name); } catch (e) { log("  ✗ " + name + ": " + e.message); } }
async function clickText(text) {
  try { const el = page.getByText(text, { exact: false }).first(); await el.click({ timeout: 4000 }); return true; } catch { return false; }
}
async function dismissOverlays() {
  for (const t of ["Reject all", "Accept all"]) { if (await clickText(t)) { await page.waitForTimeout(400); break; } }
  // close mascot / any × close buttons
  try { const x = page.locator('button:has-text("×")'); const n = await x.count(); for (let i = 0; i < n; i++) { try { await x.nth(i).click({ timeout: 800 }); } catch {} } } catch {}
  await page.waitForTimeout(300);
}

/* ── Website marketing showcase ─────────────────────────────────────────── */
log("website:");
await page.goto("https://127.0.0.1:4322/", { waitUntil: "networkidle", timeout: 30000 }).catch(() => {});
await page.waitForTimeout(1500);
await dismissOverlays();
await shot("web-01-hero");
// scroll through sections
for (let i = 1; i <= 5; i++) {
  await page.evaluate((y) => window.scrollTo(0, y * (window.innerHeight * 0.9)), i);
  await page.waitForTimeout(700);
  await shot(`web-02-section-${i}`);
}
await page.evaluate(() => window.scrollTo(0, 0));
await page.waitForTimeout(400);
await shot("web-03-hero-full", { fullPage: true });

/* ── Sign in ────────────────────────────────────────────────────────────── */
log("sign-in:");
let authed = false;
try {
  await page.evaluate(() => window.scrollTo(0, 0));
  await clickText("Sign in");
  await page.waitForTimeout(1200);
  await shot("web-04-signin-modal");
  const fields = await page.evaluate(() => Array.from(document.querySelectorAll("input")).map((i) => ({ type: i.type, name: i.name, ph: i.placeholder, id: i.id })));
  log("    login inputs: " + JSON.stringify(fields));
  if (EMAIL && PASSWORD) {
    const emailSel = 'input[type="email"], input[name="email"], input[name*="mail" i]';
    const passSel = 'input[type="password"], input[name="password"], input[name*="pass" i]';
    await page.locator(emailSel).last().fill(EMAIL, { timeout: 5000 });
    await page.locator(passSel).last().fill(PASSWORD, { timeout: 5000 });
    await shot("web-05-signin-filled");
    // submit: press Enter, or click a Sign in / Log in button inside the form
    await page.locator(passSel).last().press("Enter").catch(() => {});
    await page.waitForTimeout(3500);
    await shot("web-06-after-signin");
    authed = true;
  }
} catch (e) { log("    sign-in error: " + e.message); }

/* ── osionos app surfaces ───────────────────────────────────────────────── */
log("osionos:");
await page.goto("https://127.0.0.1:3001/", { waitUntil: "networkidle", timeout: 30000 }).catch(() => {});
await page.waitForTimeout(3000);
await shot("app-01-landing");
// If still gated, try the handoff button
const gated = await page.getByText("Open osionos from Prismatica").count().catch(() => 0);
log("    gated? " + gated);
// Try navigating to known home variants regardless
for (const [name, hash] of [["dashboard", "?home=dashboard"], ["graph", "?home=graph"], ["database", "?home=database"], ["workspace", "?home=workspace"]]) {
  try {
    await page.goto("https://127.0.0.1:3001/" + hash, { waitUntil: "networkidle", timeout: 25000 });
    await page.waitForTimeout(3500);
    await shot("app-02-" + name);
  } catch (e) { log("    " + name + " err: " + e.message); }
}

await browser.close();
log(errors.length ? "\npage errors:\n" + errors.slice(0, 8).join("\n") : "\nno page errors");
