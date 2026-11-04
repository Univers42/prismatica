import { SUPPORTED_LOCALES, DEFAULT_LOCALE, type SupportedLocale, t } from '../lib/i18n';
import { normalizeLocale, getLocaleDirection } from '../lib/locale';
import type { ThemeChoice } from '../lib/theme-config';
import { readStorage, writeStorage } from '../lib/storage';
import { queryElements, isHtmlElement } from '../lib/dom-utils';
import { formatEuros } from '../lib/money';
import { POLICY_VERSION } from '../data/legal';
import { RELEASE } from '../data/links';
import { setAnnouncementTranslator, setThemeWords } from './theme';

export const LANG_STORAGE_KEY = 'prismatica-lang';

// Text swaps through textContent, so a string held in an attribute names its own marker.
const TRANSLATED_ATTRIBUTES = [
	['data-i18n-aria-label', 'aria-label'],
	['data-i18n-alt', 'alt'],
] as const;

export const LOCALE_LABELS: Record<SupportedLocale, { nativeName: string; code: string }> = {
	en: { nativeName: 'English', code: 'EN' },
	es: { nativeName: 'Español', code: 'ES' },
	ar: { nativeName: 'العربية', code: 'AR' },
};

/**
 * Resolves initial locale from URL searchParams (?lang=...),
 * falling back to localStorage, then default locale.
 */
export function initialLocale(): SupportedLocale {
	if (typeof window !== 'undefined' && window.location) {
		const params = new URLSearchParams(window.location.search);
		const queryLang = params.get('lang');
		if (queryLang) {
			return normalizeLocale(queryLang, {
				defaultLocale: DEFAULT_LOCALE,
				supportedLocales: SUPPORTED_LOCALES,
			}) as SupportedLocale;
		}
	}

	const stored = readStorage(LANG_STORAGE_KEY);
	if (stored) {
		return normalizeLocale(stored, {
			defaultLocale: DEFAULT_LOCALE,
			supportedLocales: SUPPORTED_LOCALES,
		}) as SupportedLocale;
	}

	return DEFAULT_LOCALE;
}

/**
 * Applies locale to documentElement (lang + dir), updates URL searchParam,
 * persists to storage, updates all [data-i18n] text, and updates .lang-switcher controls.
 */
export function applyLocale(locale: SupportedLocale): void {
	if (typeof document === 'undefined') return;

	const direction = getLocaleDirection(locale);
	document.documentElement.lang = locale;
	document.documentElement.dir = direction;
	writeStorage(LANG_STORAGE_KEY, locale);

	if (typeof window !== 'undefined' && window.location && window.history) {
		try {
			const url = new URL(window.location.href);
			if (url.searchParams.get('lang') !== locale) {
				url.searchParams.set('lang', locale);
				window.history.replaceState({}, '', url.toString());
			}
		} catch {}
	}

	const params = pageParams();
	const elements = queryElements('[data-i18n]', isHtmlElement);
	elements.forEach((el) => {
		const key = el.getAttribute('data-i18n');
		if (key) {
			const translation = t(locale, key as any, params);
			if (translation) {
				el.textContent = translation;
			}
		}
	});

	translateAttributes(locale, params);
	queryElements('[data-i18n-amount]', isHtmlElement).forEach((el) => {
		el.textContent = formatEuros(locale, Number(el.dataset.i18nAmount));
	});
	updateThemeWords(locale);
	setAnnouncementTranslator((key) => t(locale, key));
	updateLanguageSwitchers(locale);
}

function pageParams(): Record<string, string> {
	return { year: String(new Date().getFullYear()), engine: RELEASE.engine, backend: RELEASE.backend, version: POLICY_VERSION };
}

function translateAttributes(locale: SupportedLocale, params: Record<string, string>): void {
	for (const [marker, attribute] of TRANSLATED_ATTRIBUTES) {
		queryElements(`[${marker}]`, isHtmlElement).forEach((el) => {
			const key = el.getAttribute(marker);
			if (key) el.setAttribute(attribute, t(locale, key, params));
		});
	}
}

function updateThemeWords(locale: SupportedLocale): void {
	const name = (choice: ThemeChoice): string => t(locale, `site.theme.${choice}`);
	setThemeWords({
		toggleLabel: (current, next) => t(locale, 'site.theme.label', { current: name(current), next: name(next) }),
		announcement: (choice) => t(locale, 'site.theme.announced', { theme: name(choice) }),
	});
}

/**
 * Updates all .lang-switcher elements with the next locale, badge, and accessibility labels.
 */
export function updateLanguageSwitchers(locale: SupportedLocale): void {
	const currentIndex = SUPPORTED_LOCALES.indexOf(locale);
	const nextIndex = (currentIndex + 1) % SUPPORTED_LOCALES.length;
	const nextLocale = SUPPORTED_LOCALES[nextIndex] ?? DEFAULT_LOCALE;

	const currentLabel = LOCALE_LABELS[locale];
	const nextLabel = LOCALE_LABELS[nextLocale];

	const switchers = queryElements('.lang-switcher', isHtmlElement);
	switchers.forEach((switcher) => {
		switcher.setAttribute('href', `?lang=${nextLocale}`);
		switcher.setAttribute('data-current-lang', locale);
		switcher.setAttribute('data-next-lang', nextLocale);
		switcher.setAttribute('aria-label', t(locale, 'site.language.label', { code: currentLabel.code, current: currentLabel.nativeName, next: nextLabel.nativeName }));
		switcher.setAttribute('title', t(locale, 'site.language.title', { next: nextLabel.nativeName }));

		const badge = switcher.querySelector('.header-icon__lang-badge');
		if (badge) {
			badge.textContent = currentLabel.code;
		}

		const label = switcher.querySelector('[data-lang-label]');
		if (label) {
			label.textContent = t(locale, 'site.language.current', { current: currentLabel.nativeName });
		}
	});
}

/**
 * Advances to the next supported locale in cyclic order: en -> es -> ar -> en.
 */
export function cycleLocale(): void {
	const current = normalizeLocale(document.documentElement.lang, {
		defaultLocale: DEFAULT_LOCALE,
		supportedLocales: SUPPORTED_LOCALES,
	}) as SupportedLocale;

	const currentIndex = SUPPORTED_LOCALES.indexOf(current);
	const nextIndex = (currentIndex + 1) % SUPPORTED_LOCALES.length;
	const nextLocale = SUPPORTED_LOCALES[nextIndex] ?? DEFAULT_LOCALE;
	applyLocale(nextLocale);
}
