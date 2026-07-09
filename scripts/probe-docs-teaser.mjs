/* probe-docs-teaser.mjs — functional check of the DocsTeaser polish:
 * link text has correct spacing, and the copy button works. */
import { createRequire } from 'node:module';
const require = createRequire('/app/package.json');
const { chromium } = require('playwright');
const browser = await chromium.launch({ args: ['--ignore-certificate-errors', '--no-sandbox'] });
const ctx = await browser.newContext({ ignoreHTTPSErrors: true, permissions: ['clipboard-read', 'clipboard-write'], viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
await page.goto('https://localhost:4322/', { waitUntil: 'networkidle', timeout: 45000 });
await page.locator('.docs-teaser__links').scrollIntoViewIfNeeded();
await page.waitForTimeout(500);

// 1. link label spacing
const labels = await page.locator('.docs-teaser__links a .docs-teaser__label').allInnerTexts();
console.log('link labels:', JSON.stringify(labels));
const spacingOk = labels.some((l) => l.includes('Auth & sessions')) && labels.some((l) => l.includes('GDPR runbook'));
console.log('spacing fixed:', spacingOk ? 'YES ✓' : 'NO ✗');

// 2. copy button
await page.locator('[data-copy-code]').scrollIntoViewIfNeeded();
await page.click('[data-copy-code]');
await page.waitForTimeout(200);
const labelText = await page.locator('[data-copy-label]').innerText();
let clip = '';
try { clip = await page.evaluate(() => navigator.clipboard.readText()); } catch {}
console.log('copy button label after click:', labelText, '(expect "Copied")');
console.log('clipboard starts with import:', clip.startsWith('import { createClient }') ? 'YES ✓' : 'NO ✗ ('+clip.slice(0,30)+')');

// 3. no console errors
const errs = [];
page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(800);
console.log('console errors:', errs.length);
await browser.close();
