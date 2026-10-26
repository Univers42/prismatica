import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SUPPORTED_LOCALES, type SupportedLocale, DEFAULT_LOCALE } from '../../../src/lib/i18n';
import { readStorage, writeStorage } from '../../../src/lib/storage';
import { initialLocale, applyLocale, cycleLocale } from '../../../src/scripts/language';

beforeEach(() => {
});

afterEach(() => {
	globalThis.localStorage.clear();
});

describe('initialLocale', () => {
	it('reads ?lang=es from window.location', () => {
		globalThis.window = {
			location: {
				search: '?lang=es',
				href: 'http://localhost/',
			},
		} as any;
		expect(initialLocale()).toBe('es');
	});

	it('reads from localStorage when URL has no lang param', () => {
		writeStorage('prismatica-lang', 'es');
		expect(initialLocale()).toBe('es');
	});

	it('falls back to DEFAULT_LOCALE en when no URL param or storage', () => {
		globalThis.window = {
			location: {
				search: '',
				href: 'http://localhost/',
			},
		} as any;
		expect(initialLocale()).toBe(DEFAULT_LOCALE);
	});
});

describe('applyLocale', () => {
	beforeEach(() => {
		globalThis.document = {
			documentElement: {
				lang: '',
				dir: '',
				setAttribute: function (_key: string, _value: string) {
					;(globalThis.document as any).documentElement[_key] = _value;
				},
			},
			body: { innerHTML: '' },
			createElement: function () {
				return {} as HTMLElement;
			},
			querySelector: function () {
				return null;
			},
			querySelectorAll: function () {
				return [];
			},
		} as any;
	});

	it('updates html[lang] and html[dir] for es', () => {
		applyLocale('es' as SupportedLocale);
		expect((globalThis.document as any).documentElement.lang).toBe('es');
		expect((globalThis.document as any).documentElement.dir).toBe('ltr');
	});

	it('updates html[lang] and html[dir] for ar (rtl)', () => {
		applyLocale('ar' as SupportedLocale);
		expect((globalThis.document as any).documentElement.lang).toBe('ar');
		expect((globalThis.document as any).documentElement.dir).toBe('rtl');
	});

	it('persists locale to localStorage', () => {
		applyLocale('es' as SupportedLocale);
		expect(readStorage('prismatica-lang')).toBe('es');
	});
});

describe('cycleLocale', () => {
	it('cycles en -> es -> ar -> en', () => {
		;(globalThis.document as any).documentElement.lang = 'en' as any;
		cycleLocale();
		expect((globalThis.document as any).documentElement.lang).toBe('es');

		cycleLocale();
		expect((globalThis.document as any).documentElement.lang).toBe('ar');

		cycleLocale();
		expect((globalThis.document as any).documentElement.lang).toBe('en');
	});
});