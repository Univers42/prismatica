import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const layoutPath = path.resolve(process.cwd(), 'src/layouts/Layout.astro');
const layoutMarkup = fs.readFileSync(layoutPath, 'utf-8');

describe('Layout.astro', () => {
	describe('imports', () => {
		it('imports normalizeLocale and getLocaleDirection from ../lib/locale', () => {
			expect(layoutMarkup).toContain('import { normalizeLocale, getLocaleDirection } from \'../lib/locale\'');
		});

		it('imports i18n helpers from ../lib/i18n', () => {
			expect(layoutMarkup).toContain('import { DEFAULT_LOCALE, SUPPORTED_LOCALES, t, type SupportedLocale } from \'../lib/i18n\'');
		});
	});

	describe('Props', () => {
		it('declares locale?: string in type Props', () => {
			expect(layoutMarkup).toContain('locale?: string');
		});
	});

	describe('dynamic attributes', () => {
		it('binds lang attribute dynamically: <html lang={activeLocale}>', () => {
			expect(layoutMarkup).toContain('<html lang={activeLocale}');
		});

		it('binds dir attribute dynamically for RTL mirroring: dir={direction}', () => {
			expect(layoutMarkup).toContain('dir={direction}');
		});
	});

	// Firefox warned "instrument-serif.woff2 preloaded with link preload was not used within a few
	// seconds" on the old default theme, which set its display text in Space Grotesk. The redesign
	// paints every heading in the serif, so its Latin subset is the one font worth preloading, and
	// the full face must stay off the preload list.
	describe('display serif loading', () => {
		it('does not preload the full instrument-serif.woff2', () => {
			expect(layoutMarkup).not.toMatch(/rel="preload"[^>]*instrument-serif\.woff2/);
		});

		it('preloads the Latin display face every heading paints first', () => {
			expect(layoutMarkup).toMatch(/rel="preload" href="\/fonts\/instrument-serif-latin\.woff2"/);
		});
	});

	describe('translated skip-link', () => {
		it('uses translated a11y skip-link text: {t(activeLocale, a11y.skipToContent)} on .skip-link', () => {
			expect(layoutMarkup).toContain("{t(activeLocale, 'a11y.skipToContent')}");
		});
	});
});