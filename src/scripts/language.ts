import { SUPPORTED_LOCALES, DEFAULT_LOCALE, type SupportedLocale, t } from '../lib/i18n';
import { normalizeLocale, getLocaleDirection } from '../lib/locale';
import { readStorage, writeStorage } from '../lib/storage';
import { queryElements, isHtmlElement } from '../lib/dom-utils';

export const LANG_STORAGE_KEY = 'prismatica-lang';

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

	const elements = queryElements('[data-i18n]', isHtmlElement);
	elements.forEach((el) => {
		const key = el.getAttribute('data-i18n');
		if (key) {
			const translation = t(locale, key as any);
			if (translation) {
				el.textContent = translation;
			}
		}
	});

	updateLanguageSwitchers(locale);
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
		switcher.setAttribute('aria-label', `Language: ${currentLabel.nativeName}. Switch to ${nextLabel.nativeName}`);
		switcher.setAttribute('title', `Switch to ${nextLabel.nativeName} language`);

		const badge = switcher.querySelector('.header-icon__lang-badge');
		if (badge) {
			badge.textContent = currentLabel.code;
		}

		const label = switcher.querySelector('[data-lang-label]');
		if (label) {
			label.textContent = `Language: ${currentLabel.nativeName}`;
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

/**
 * Binds click listeners to .lang-switcher buttons and popstate navigation.
 */
export function bindLanguageControls(): void {
	const switchers = queryElements('.lang-switcher', isHtmlElement);
	switchers.forEach((switcher) => {
		switcher.addEventListener('click', (e) => {
			e.preventDefault();
			cycleLocale();
		});
	});

	if (typeof window !== 'undefined') {
		window.addEventListener('popstate', () => {
			applyLocale(initialLocale());
		});
	}
}