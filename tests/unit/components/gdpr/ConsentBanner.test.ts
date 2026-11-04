import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const banner = fs.readFileSync(path.resolve(process.cwd(), 'src/components/gdpr/ConsentBanner.astro'), 'utf-8');
const styles = fs.readFileSync(path.resolve(process.cwd(), 'src/styles/components/_gdpr.scss'), 'utf-8');

describe('ConsentBanner', () => {
	// It does not take the page over, so it is not a dialog: it stays a labelled region, and the
	// sign-in and tour dialogs remain the only ones a screen reader finds.
	it('is a labelled region, not a dialog', () => {
		expect(banner).not.toMatch(/role="dialog"|aria-modal/);
		expect(banner).toMatch(/<section\b[^>]*aria-labelledby="consent-title"/);
	});

	it('stays focusable, because consent.ts moves focus to it', () => {
		expect(banner).toMatch(/<section\b[^>]*tabindex="-1"/);
	});

	it('stays reachable when the open preferences are taller than the screen', () => {
		expect(styles).toMatch(/\.consent-banner__paper \{[^}]*max-block-size: calc\(100dvh - 2rem\);[^}]*overflow-y: auto;/);
	});

	it('takes its layer from the token scale', () => {
		expect(styles).toMatch(/\.consent-banner \{[^}]*z-index: var\(--z-dialog\);/);
	});
});
