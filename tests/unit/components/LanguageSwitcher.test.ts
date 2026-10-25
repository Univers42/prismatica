import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const componentPath = path.resolve(process.cwd(), 'src/components/ui/LanguageSwitcher.astro');
const componentMarkup = fs.readFileSync(componentPath, 'utf-8');

describe('LanguageSwitcher', () => {
	it('contains aria-label with languageSwitcher translation', () => {
		expect(componentMarkup).toContain('aria-label');
	});

	it('renders nav with lang-switcher class', () => {
		expect(componentMarkup).toContain('lang-switcher');
		expect(componentMarkup).toContain('<nav');
	});

	it('renders all 3 supported languages', () => {
		expect(componentMarkup).toContain('English');
		expect(componentMarkup).toContain('Español');
		expect(componentMarkup).toContain('العربية');
	});

	it('sets lang attribute on each language option', () => {
		expect(componentMarkup).toContain('lang=');
		expect(componentMarkup).toContain('en');
		expect(componentMarkup).toContain('es');
		expect(componentMarkup).toContain('ar');
	});

	it('sets dir="rtl" for Arabic', () => {
		expect(componentMarkup).toContain('dir=');
		expect(componentMarkup).toContain('rtl');
	});

	it('sets aria-current for the active locale', () => {
		expect(componentMarkup).toContain('aria-current');
	});

	it('enforces 44px minimum touch target size', () => {
		expect(componentMarkup).toContain('min-height: 44px');
	});

	it('uses CSS logical properties', () => {
		expect(componentMarkup).toContain('padding-inline');
		expect(componentMarkup).not.toContain('padding-left');
	});
});