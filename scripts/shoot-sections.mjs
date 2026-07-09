/* shoot-sections.mjs — scroll each swipe-stack scene into view and screenshot,
 * so scroll-reveal content is actually visible. app-browser-tests, --network host. */
import { createRequire } from 'node:module';
const require = createRequire('/app/package.json');
const { chromium } = require('playwright');
const OUT = '/shots';
const URL = process.env.SITE_URL || 'https://localhost:4322/';

const browser = await chromium.launch({ args: ['--ignore-certificate-errors', '--no-sandbox'] });
const ctx = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
const page = await ctx.newPage();
await page.goto(URL, { waitUntil: 'networkidle', timeout: 45000 });
for (const t of ['Reject all', 'Accept all']) { try { await page.getByRole('button', { name: t }).first().click({ timeout: 1500 }); break; } catch {} }
await page.waitForTimeout(600);

const scenes = await page.$$('.swipe-stack__scene, .swipe-stack__tail');
console.log('scenes:', scenes.length);
let i = 0;
for (const s of scenes) {
	await s.scrollIntoViewIfNeeded();
	await page.waitForTimeout(900); // let reveal animation finish
	await page.screenshot({ path: `${OUT}/sec-${String(i).padStart(2, '0')}.png` });
	i++;
}
await browser.close();
console.log('done', i);
