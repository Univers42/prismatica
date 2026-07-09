/* click-docs.mjs — end-to-end proof: on the live Prismatica homepage, click the
 * header "Docs" button and confirm it navigates to the self-hosted docs system. */
import { createRequire } from "node:module";
const require = createRequire("/app/package.json");
const { chromium } = require("playwright");
const SHOTS = "/shots";
const browser = await chromium.launch({ args: ["--ignore-certificate-errors"] });
const ctx = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
await page.goto("https://127.0.0.1:4322/", { waitUntil: "networkidle", timeout: 30000 });
await page.waitForTimeout(1500);
// dismiss consent if present
for (const t of ["Reject all", "Accept all"]) { try { await page.getByText(t, { exact: false }).first().click({ timeout: 2500 }); break; } catch {} }
await page.waitForTimeout(500);
await page.screenshot({ path: `${SHOTS}/final-01-home-header.png` });
// click the header Docs link
await page.click('a.header-new__link[href="/docs/"]', { timeout: 6000 });
await page.waitForLoadState("networkidle", { timeout: 30000 });
await page.waitForTimeout(1500);
const url = page.url();
await page.screenshot({ path: `${SHOTS}/final-02-docs-landed.png` });
console.log("landed URL: " + url + (url.includes("/docs") ? "  ✓ Docs button → docs system" : "  ✗ did NOT reach /docs"));
await browser.close();
