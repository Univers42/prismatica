#!/usr/bin/env node
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const DIST_DIR = '/workspace/dist';
const PORT = 4322;
const BASE_URL = `http://127.0.0.1:${PORT}`;
const ROUTES = [
	'/',
	'/?lang=es',
	'/?lang=ar',
	'/legal/privacy-policy/',
	'/legal/terms/',
	'/legal/cookies/',
	'/legal/data-rights/',
];
const VALID_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

async function runAudit() {
	const browser = await chromium.launch({
		args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
	});
	const context = await browser.newContext();
	const page = await context.newPage();

	let allViolations = 0;
	const results = [];

	for (const route of ROUTES) {
		const url = `${BASE_URL}${route}`;
		console.log(`Auditing: ${url}...`);

		try {
			await page.goto(url, { waitUntil: 'networkidle' });

			await page.addScriptTag({
				path: path.resolve(
					'node_modules/.pnpm/axe-core@4.14.0/node_modules/axe-core/axe.min.js',
				),
			});

			const violations = await page.evaluate(async () => {
				const { default: axe } = await import('axe-core');
				return await axe.run(null, {
					tags: VALID_TAGS,
				});
			});

			const routeViolations = violations.length;
			allViolations += routeViolations;

			if (routeViolations > 0) {
				results.push({
					route,
					url,
					violations: routeViolations,
					firstViolation: violations[0]?.description || 'N/A',
				});
				console.log(`  Found ${routeViolations} violation(s)`);
				violations.forEach((v, i) => {
					console.log(`  ${i + 1}. ${v.description} (${v.tags.join(', ')})`);
				});
			} else {
				console.log('  0 violations');
			}
		} catch (error) {
			console.error(`  Error auditing ${url}:`, error.message);
			results.push({
				route,
				url,
				violations: -1,
				error: error.message,
			});
		}
	}

	await browser.close();

	console.log('\n' + '='.repeat(60));
	console.log('WCAG 2.2 AA Accessibility Audit Summary');
	console.log('='.repeat(60));

	results.forEach((r) => {
		const status = r.violations >= 0 ? `${r.violations} violation(s)` : `Error: ${r.error}`;
		console.log(`\n${r.url}`);
		console.log(`  Status: ${status}`);
	});

	console.log('\nTotal violations across all routes:', allViolations);

	if (allViolations > 0) {
		console.log('\n❌ Audit FAILED: Accessibility violations found');
		process.exit(1);
	} else {
		console.log('\n✅ Audit PASSED: 0 accessibility violations found');
		process.exit(0);
	}
}

runAudit().catch((error) => {
	console.error('Audit script failed:', error);
	process.exit(1);
});