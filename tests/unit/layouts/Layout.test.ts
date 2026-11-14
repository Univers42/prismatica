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

	// Keep font loading on the @font-face path. Its local() source lets browsers use an
	// installed face without downloading the web font; preloading bypasses that choice and
	// Firefox can warn when the preloaded file is not consumed.
	describe('font loading', () => {
		it('does not preload fonts that can resolve from a local face', () => {
			expect(layoutMarkup).not.toMatch(/rel="preload"[^>]*space-grotesk/);
			expect(layoutMarkup).not.toMatch(/rel="preload"[^>]*instrument-serif/);
		});
	});

	describe('translated skip-link', () => {
		it('uses translated a11y skip-link text: {t(activeLocale, a11y.skipToContent)} on .skip-link', () => {
			expect(layoutMarkup).toContain("{t(activeLocale, 'a11y.skipToContent')}");
		});
	});
});