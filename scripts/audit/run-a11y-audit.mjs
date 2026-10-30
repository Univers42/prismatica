#!/usr/bin/env node
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import http from 'http';

const DIST_DIR = path.resolve('dist');
const PORT = 4398;
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
const AXE_CORE_PATH = path.resolve('node_modules/.pnpm/axe-core@4.14.0/node_modules/axe-core/axe.min.js');

function getMimeType(filePath) {
	const ext = path.extname(filePath);
	const mimeTypes = {
		'.html': 'text/html',
		'.css': 'text/css',
		'.js': 'application/javascript',
		'.svg': 'image/svg+xml',
		'.png': 'image/png',
		'.woff2': 'font/woff2',
	};
	return mimeTypes[ext] || 'application/octet-stream';
}

function serveStatic(req, res) {
	const url = new URL(req.url, `http://127.0.0.1:${PORT}`);
	let filePath = path.join(DIST_DIR, decodeURIComponent(url.pathname));
	if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
		filePath = path.join(filePath, 'index.html');
	}

	fs.readFile(filePath, (err, content) => {
		if (err) {
			res.writeHead(404, { 'Content-Type': 'text/plain' });
			res.end('404 Not Found');
		} else {
			res.writeHead(200, { 'Content-Type': getMimeType(filePath) });
			res.end(content);
		}
	});
}

async function runAudit() {
	const server = http.createServer(serveStatic);
	await new Promise(resolve => server.listen(PORT, '127.0.0.1', resolve));
	console.log(`Server running at ${BASE_URL}`);

	let allViolations = 0;
	const results = [];
	let hasError = false;

	const browser = await chromium.launch({
		executablePath: process.env.CHROME_BIN || (fs.existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined),
		args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
		env: { ...process.env, HOME: '/tmp' },
	});
	const context = await browser.newContext({ bypassCSP: true });
	const page = await context.newPage();

	try {
		for (const route of ROUTES) {
			const url = `${BASE_URL}${route}`;
			console.log(`Auditing: ${url}...`);

			try {
				await page.goto(url, { waitUntil: 'networkidle' });

				await page.addScriptTag({
					path: AXE_CORE_PATH,
				});

				const res = await page.evaluate(
					async (tags) => {
						return await window.axe.run(document, {
							runOnly: { type: 'tag', values: tags },
						});
					},
					VALID_TAGS
				);

				const violations = res.violations;
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
				hasError = true;
				break;
			}
		}
	} finally {
		await browser.close();
		server.close();
	}

	if (hasError) {
		console.log('\n❌ Audit FAILED: Error encountered while auditing');
		process.exit(1);
	}

	console.log('\n' + '='.repeat(60));
	console.log('WCAG 2.2 AA Accessibility Audit Summary');
	console.log('='.repeat(60));

	results.forEach((r) => {
		console.log(`\n${r.url}`);
		console.log(`  Status: ${r.violations} violation(s)`);
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