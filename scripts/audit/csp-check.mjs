#!/usr/bin/env node
// Loads the served site in headless Chromium with its real CSP in force and fails on any
// securitypolicyviolation. astro.config.mjs keeps 'unsafe-inline' out of style-src on the strength of
// this check. Serve dist first: astro preview --host 127.0.0.1 --port 4399.
//
// Caveat: it sees what a page does on load, in Chromium, on ROUTES. A violation behind a click (the
// sign-in portal, a language change) or on a page added without extending ROUTES passes here. The
// groot ST specs drive those paths with a console guard.
import { launchChromium } from './launch-chromium.mjs';

const ROUTES = [
	'/',
	'/?lang=es',
	'/?lang=ar',
	'/tour/',
	'/404.html',
	'/docs/',
	'/docs/graph/performance-tuning/',
	'/auth/approve/',
	'/auth/callback/',
	'/auth/confirm/',
	'/auth/reset-password/',
	'/legal/privacy-policy/',
	'/legal/terms/',
	'/legal/cookies/',
	'/legal/data-rights/',
	'/newsletter/confirm/',
	'/newsletter/unsubscribe/',
];

async function run(base) {
	const browser = await launchChromium();
	const page = await browser.newPage();
	const violations = [];
	await page.exposeFunction('reportCspViolation', (violation) => violations.push(violation));
	await page.addInitScript(() => {
		document.addEventListener('securitypolicyviolation', (event) => {
			globalThis.reportCspViolation(`${event.violatedDirective} blocked ${event.blockedURI || 'inline'} at ${event.sourceFile || 'document'}:${event.lineNumber}`);
		});
	});
	let failures = 0;
	for (const route of ROUTES) {
		violations.length = 0;
		const response = await page.goto(new URL(route, base).href, { waitUntil: 'networkidle' });
		if (!response?.ok()) violations.push(`HTTP ${response?.status() ?? 'no response'}`);
		failures += violations.length;
		console.log(`${violations.length === 0 ? 'ok  ' : 'FAIL'} ${route}`);
		for (const violation of violations) console.log(`     ${violation}`);
	}
	await browser.close();
	console.log(`${ROUTES.length} routes, ${failures} violation(s)`);
	return failures;
}

const base = process.argv.find((arg) => arg.startsWith('http'));
if (!base) {
	console.error('csp-check: pass the served base URL, for example http://127.0.0.1:4399');
	process.exit(2);
}
process.exitCode = (await run(base)) === 0 ? 0 : 1;
