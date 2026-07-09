/* probe-app.mjs — capture the entry/login state of the running osionos + website
 * so we can script an authenticated screenshot pass. Runs in app-browser-tests:latest
 * with --network host so 127.0.0.1:3001/4322 reach the host apps. */
import { createRequire } from "node:module";
const require = createRequire("/app/package.json");
const { chromium } = require("playwright");

const SHOTS = "/shots";
const browser = await chromium.launch({ args: ["--ignore-certificate-errors"] });
const ctx = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
const page = await ctx.newPage();

async function probe(name, url) {
  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 25000 });
    await page.waitForTimeout(2500);
    await page.screenshot({ path: `${SHOTS}/probe-${name}.png` });
    const info = await page.evaluate(() => ({
      url: location.href,
      title: document.title,
      inputs: Array.from(document.querySelectorAll("input")).map((i) => ({ type: i.type, name: i.name, ph: i.placeholder, id: i.id })).slice(0, 12),
      buttons: Array.from(document.querySelectorAll("button, a[role=button], [type=submit]")).map((b) => (b.textContent || "").trim()).filter(Boolean).slice(0, 20),
      h1: (document.querySelector("h1, h2") || {}).textContent || "",
    }));
    console.log(`\n### ${name} (${url})`);
    console.log(JSON.stringify(info, null, 2));
  } catch (e) {
    console.log(`\n### ${name} (${url}) — ERROR ${e.message}`);
  }
}

await probe("osionos", "https://127.0.0.1:3001/");
await probe("website", "https://127.0.0.1:4322/");
await browser.close();
