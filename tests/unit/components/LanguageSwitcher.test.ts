import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const componentPath = path.resolve(process.cwd(), 'src/components/ui/LanguageSwitcher.astro');
const componentMarkup = fs.readFileSync(componentPath, 'utf-8');

const localeTestCases = [
	{ locale: 'en', expectedNext: 'es', currentLabel: 'English', nextLabel: 'Español' },
	{ locale: 'es', expectedNext: 'ar', currentLabel: 'Español', nextLabel: 'العربية' },
	{ locale: 'ar', expectedNext: 'en', currentLabel: 'العربية', nextLabel: 'English' },
];

describe('LanguageSwitcher', () => {
	it.each([
		['header-new__theme class', 'header-new__theme'],
		['lang-switcher class', 'lang-switcher'],
		['aria-label dynamic template', 'aria-label'],
		['header-icon--lang SVG icon', 'header-icon--lang'],
		['CSS logical property inset-inline-end', 'inset-inline-end'],
		['CSS logical property no left', { not: 'padding-left' }],
	])('markup contracts: %s', (_, search) => {
		if (search instanceof Object && 'not' in search) {
			expect(componentMarkup).not.toContain(search.not);
		} else {
			expect(componentMarkup).toContain(search);
		}
	});

	it.each(localeTestCases)('renders LOCALE_LABELS for $currentLabel', ({ currentLabel, nextLabel }) => {
		expect(componentMarkup).toContain(currentLabel);
		expect(componentMarkup).toContain(nextLabel);
	});

	it('next locale cycle order', () => {
		expect(componentMarkup).toContain('nextIndex = (currentIndex + 1) % SUPPORTED_LOCALES.length');
		expect(componentMarkup).toContain('LOCALE_LABELS: Record');
	});

	it('drawer mode: isDrawer handling and header-new__theme--drawer', () => {
		expect(componentMarkup).toContain('isDrawer');
		expect(componentMarkup).toContain('header-new__theme--drawer');
	});
});