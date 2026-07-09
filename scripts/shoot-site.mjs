/* shoot-site.mjs — full-page + per-section screenshots of the live Prismatica
 * site for a visual design review. Run in app-browser-tests with --network host.
 *   docker run --rm --network host -v "$PWD":/repo -w /repo/apps/opposite-osiris \
 *     -v /tmp/shots:/shots --entrypoint node app-browser-tests:latest scripts/shoot-site.mjs */
import { createRequire } from 'node:module';
const require = createRequire('/app/package.json');
const { chromium } = require('playwright');
const OUT = '/shots';
const URL = process.env.SITE_URL || 'https://localhost:4322/';

const browser = await chromium.launch({ args: ['--ignore-certificate-errors', '--no-sandbox'] });

async function shoot(tag, { width, height, theme }) {
	const ctx = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width, height }, deviceScaleFactor: 1 });
	const page = await ctx.newPage();
	await page.goto(URL, { waitUntil: 'networkidle', timeout: 45000 });
	// dismiss consent banner if present
	for (const t of ['Reject all', 'Accept all', 'Accept']) {
		try { await page.getByRole('button', { name: t, exact: false }).first().click({ timeout: 1500 }); break; } catch {}
	}
	if (theme) {
		await page.evaluate((th) => document.documentElement.setAttribute('data-theme', th), theme);
		await page.waitForTimeout(400);
	}
	await page.waitForTimeout(800);
	await page.screenshot({ path: `${OUT}/${tag}-full.png`, fullPage: true });
	await page.screenshot({ path: `${OUT}/${tag}-fold.png`, fullPage: false });
	console.log(`shot ${tag} (${width}x${height}${theme ? ' ' + theme : ''})`);
	await ctx.close();
}

await shoot('desktop-solar', { width: 1440, height: 900 });
await shoot('mobile-solar', { width: 390, height: 844 });
await shoot('desktop-aurora', { width: 1440, height: 900, theme: 'aurora' });
await browser.close();
console.log('done');
