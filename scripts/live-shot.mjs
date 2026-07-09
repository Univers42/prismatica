/* live-shot.mjs — screenshot the SELF-HOSTED docs on the real Prismatica site
 * (https://localhost:4322/docs) through the actual proxy. Confirms the inline
 * shell JS runs under the site's CSP. Run in app-browser-tests with --network host. */
import { createRequire } from "node:module";
const require = createRequire("/app/package.json");
const { chromium } = require("playwright");
const SHOTS = "/shots";
const errs = [];
const browser = await chromium.launch({ args: ["--ignore-certificate-errors"] });
const ctx = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
page.on("pageerror", (e) => errs.push("pageerror: " + e.message));
page.on("console", (m) => { if (m.type() === "error") errs.push("console: " + m.text()); });

await page.goto("https://127.0.0.1:4322/docs/", { waitUntil: "networkidle", timeout: 30000 });
await page.waitForTimeout(1500);
await page.screenshot({ path: `${SHOTS}/live-01-docs-home.png` });
// test interactivity under the site's CSP: open a deep doc via the tree
await page.evaluate(() => { location.hash = "#tour"; });
await page.waitForTimeout(1000);
await page.screenshot({ path: `${SHOTS}/live-02-tour.png` });
// palette
await page.keyboard.press("Control+k");
await page.waitForTimeout(400);
await page.keyboard.type("graph");
await page.waitForTimeout(300);
await page.screenshot({ path: `${SHOTS}/live-03-palette.png` });
await browser.close();
console.log(errs.length ? "⚠ errors:\n" + errs.slice(0, 8).join("\n") : "✓ interactive, no console errors — inline JS runs under the site CSP");
