import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// Each doc is its own page load (D-035), so an entrance animation on the article only holds back
// its first paint. A fade from opacity 0 put mobile LCP on /docs/ at 2.61 s against the 2.5 s
// budget (phase6 audit, 2 010 ms of render delay on the first paragraph).
const shellCss = readFileSync(join(process.cwd(), 'scripts/vault-shell.css'), 'utf8');

// Caveat: a regex reading of flat CSS. An animation set through a custom property, or a rule
// nested inside @media, is not seen, so the check under-reports there.
function hidingAnimations(css, selector) {
	const startsHidden = new Set(
		[...css.matchAll(/@keyframes\s+([\w-]+)\s*\{\s*(?:from|0%)\s*\{([^}]*)\}/g)]
			.filter(([, , from]) => /opacity\s*:\s*0(?:\.0+)?\s*(?:;|$)/.test(from))
			.map(([, name]) => name),
	);
	return [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
		.filter(([, selectors]) => selectors.split(',').some((s) => s.trim() === selector))
		.flatMap(([, , body]) => [...body.matchAll(/animation(?:-name)?\s*:\s*([\w-]+)/g)].map(([, name]) => name))
		.filter((name) => startsHidden.has(name));
}

describe('vault-shell.css first paint', () => {
	it.each(['.doc', '.doc-host', '.shell', '.shell__main'])('%s does not start invisible', (selector) => {
		expect(hidingAnimations(shellCss, selector)).toEqual([]);
	});

	it('sees a planted fade-in, so the check above can fail', () => {
		const planted = '.doc { animation: docin 1s ease; }\n@keyframes docin { from { opacity: 0; transform: none; } to { opacity: 1; } }';
		expect(hidingAnimations(planted, '.doc')).toEqual(['docin']);
	});
});
