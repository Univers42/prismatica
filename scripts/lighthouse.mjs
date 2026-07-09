/* ==========================================================================
 * lighthouse.mjs — reproducible Lighthouse gate for the Prismatica site.
 *
 * Scores are ONLY meaningful against a PRODUCTION build (astro dev is ~59/92;
 * the shipped nginx image / `astro preview` is 97-100 — see the "dev trap" in
 * docs). Runs the bundled lighthouse CLI through `npx` so nothing extra is
 * pinned in the image. Chromium is resolved from CHROME_PATH or the Playwright
 * browser bundle, so this runs inside the `app-browser-tests` image.
 *
 *   node scripts/lighthouse.mjs <url> [--min=90] [--preset=desktop|mobile]
 *
 * Docker (prod build already served by the web container on the host proxy):
 *   docker run --rm --network host \
 *     -e CHROME_PATH=/ms-playwright/chromium-1217/chrome-linux64/chrome \
 *     -v "$PWD":/repo -w /repo/apps/opposite-osiris --entrypoint node \
 *     app-browser-tests:latest scripts/lighthouse.mjs https://localhost:4322/
 * ========================================================================== */
import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, readdirSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';

const CATEGORIES = ['performance', 'accessibility', 'best-practices', 'seo'];
const REPORT_DIR = resolve(process.cwd(), 'test-results/lighthouse');

// Resolve a Chromium/Chrome binary: explicit env first, then the Playwright
// bundle (any chromium-* version), then a system chrome.
function resolveChrome() {
	if (process.env.CHROME_PATH && existsSync(process.env.CHROME_PATH)) return process.env.CHROME_PATH;
	const pw = process.env.PLAYWRIGHT_BROWSERS_PATH || '/ms-playwright';
	if (existsSync(pw)) {
		for (const dir of readdirSync(pw).filter((d) => d.startsWith('chromium-'))) {
			for (const sub of ['chrome-linux64/chrome', 'chrome-linux/chrome']) {
				const bin = join(pw, dir, sub);
				if (existsSync(bin)) return bin;
			}
		}
	}
	for (const sys of ['/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser']) {
		if (existsSync(sys)) return sys;
	}
	throw new Error('No Chromium/Chrome binary found (set CHROME_PATH).');
}

function parseArgs(argv) {
	const url = argv.find((a) => /^https?:\/\//.test(a)) ?? process.env.LH_URL ?? 'https://localhost:4322/';
	const min = Number(argv.find((a) => a.startsWith('--min='))?.slice(6) ?? process.env.LH_MIN ?? 90);
	const preset = argv.find((a) => a.startsWith('--preset='))?.slice(9);
	return { url, min, preset, chrome: resolveChrome() };
}

function runLighthouse({ url, preset, chrome }) {
	mkdirSync(REPORT_DIR, { recursive: true });
	const jsonPath = resolve(REPORT_DIR, 'report.json');
	// --ignore-certificate-errors: the local prod build is served over the
	// self-signed track-binocle CA, which Chrome would otherwise reject.
	const args = [
		'-y', 'lighthouse@12', url,
		'--quiet',
		`--only-categories=${CATEGORIES.join(',')}`,
		'--chrome-flags=--headless=new --no-sandbox --disable-gpu --disable-dev-shm-usage --ignore-certificate-errors',
		'--output=json',
		`--output-path=${jsonPath}`,
	];
	if (preset) args.push(`--preset=${preset}`);
	const result = spawnSync('npx', args, {
		stdio: ['ignore', 'ignore', 'inherit'],
		env: { ...process.env, CHROME_PATH: chrome },
	});
	if (result.status !== 0) throw new Error(`lighthouse exited with code ${result.status}`);
	return jsonPath;
}

function reportScores(jsonPath, min) {
	const report = JSON.parse(readFileSync(jsonPath, 'utf8'));
	let failed = false;
	console.log(`\nLighthouse — ${report.finalDisplayedUrl ?? report.requestedUrl}`);
	for (const key of CATEGORIES) {
		const score = Math.round((report.categories[key]?.score ?? 0) * 100);
		const ok = score >= min;
		failed = failed || !ok;
		console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${key.padEnd(16)} ${score}`);
	}
	console.log(`\nJSON report: ${jsonPath}`);
	return !failed;
}

function main() {
	const options = parseArgs(process.argv.slice(2));
	const jsonPath = runLighthouse(options);
	const passed = reportScores(jsonPath, options.min);
	process.exit(passed ? 0 : 1);
}

main();
