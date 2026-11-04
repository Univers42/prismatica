import { describe, expect, it } from 'vitest';
import { DICTIONARY, SUPPORTED_LOCALES, t } from '../../../src/lib/i18n';

type Tree = { readonly [key: string]: string | Tree };

function flatten(tree: Tree, prefix = ''): [string, string][] {
	return Object.entries(tree).flatMap(([key, value]) =>
		typeof value === 'string' ? [[`${prefix}${key}`, value] as [string, string]] : flatten(value, `${prefix}${key}.`),
	);
}

const site = (locale: 'en' | 'es' | 'ar'): Map<string, string> => new Map(flatten(DICTIONARY[locale].site as unknown as Tree));
const placeholders = (text: string): string[] => (text.match(/{[a-zA-Z0-9_]+}/g) ?? []).sort();
const ARABIC_LETTER = /[؀-ۿ]/;

// Spanish uses the English word here.
const SAME_IN_SPANISH = new Set(['consent.marketing']);

describe('site strings', () => {
	const en = site('en');

	it('holds a real amount of copy', () => {
		expect(en.size).toBeGreaterThan(100);
	});

	it.each(['es', 'ar'] as const)('%s has exactly the keys of en', (locale) => {
		expect([...site(locale).keys()].sort()).toEqual([...en.keys()].sort());
	});

	it.each(['es', 'ar'] as const)('%s keeps every placeholder of en', (locale) => {
		for (const [key, value] of site(locale)) {
			expect(placeholders(value), key).toEqual(placeholders(en.get(key) ?? ''));
		}
	});

	it('leaves no empty string, which applyLocale would skip and leave English on screen', () => {
		for (const locale of SUPPORTED_LOCALES) {
			for (const [key, value] of site(locale)) expect(value.trim(), `${locale} ${key}`).not.toBe('');
		}
	});

	it('es is translated', () => {
		for (const [key, value] of site('es')) {
			if (SAME_IN_SPANISH.has(key)) continue;
			expect(value, key).not.toBe(en.get(key));
		}
	});

	it('ar is written in Arabic', () => {
		for (const [key, value] of site('ar')) expect(value, key).toMatch(ARABIC_LETTER);
	});

	it('isolates a Latin run in Arabic that ends in punctuation, which bidi would otherwise scramble', () => {
		expect(DICTIONARY.ar.site.run.platforms).toMatch(/\u2066Linux \(AppImage, \.deb\)\u2069/);
		expect(DICTIONARY.ar.site.run.platforms).toMatch(/\u2066Windows \(\.exe\)\u2069/);
	});

	it('resolves through t() in every locale', () => {
		for (const locale of SUPPORTED_LOCALES) {
			expect(t(locale, 'site.hero.title')).toBe(DICTIONARY[locale].site.hero.title);
		}
	});
});
