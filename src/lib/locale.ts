export type Direction = 'ltr' | 'rtl';

export interface LocaleConfig {
  readonly defaultLocale: string;
  readonly supportedLocales: readonly string[];
  readonly rtlLocales?: readonly string[];
}

export const DEFAULT_RTL_LOCALES: readonly string[] = ['ar', 'he', 'fa', 'ur'];

/**
 * Checks if a locale is RTL (right-to-left).
 * Normalizes customRtlList entries to lowercase for case-insensitive comparison.
 * @param locale - The locale string to check (e.g. 'ar', 'ar-EG', 'he_IL')
 * @param customRtlList - Optional custom list of RTL locale codes; defaults to DEFAULT_RTL_LOCALES
 * @returns true if the locale is RTL, false otherwise
 */
export function isRtlLocale(locale: string, customRtlList?: readonly string[]): boolean {
  const trimmed = locale.trim();
  if (trimmed === '') {
    return false;
  }
  const baseCode = trimmed.split(/[-_]/)[0].toLowerCase();
  const rtlList = (customRtlList ?? DEFAULT_RTL_LOCALES).map((item) => item.trim().toLowerCase());
  return rtlList.includes(baseCode);
}

/**
 * Gets the text direction for a locale ('rtl' or 'ltr').
 * @param locale - The locale string (e.g. 'ar', 'en', 'pt-BR')
 * @param customRtlList - Optional custom list of RTL locale codes
 * @returns 'rtl' if the locale is right-to-left, 'ltr' otherwise
 */
export function getLocaleDirection(locale: string, customRtlList?: readonly string[]): Direction {
  return isRtlLocale(locale, customRtlList) ? 'rtl' : 'ltr';
}

/**
 * Normalizes a locale string to a configured locale, preserving the configured casing.
 * Performs case-insensitive matching against supportedLocales and returns the exact configured string.
 * @param rawLocale - The raw locale string to normalize (e.g. 'pt-br', 'PT_BR', 'AR')
 * @param config - Configuration with defaultLocale and supportedLocales
 * @returns The matched configured locale string, or the defaultLocale if no match is found
 */
export function normalizeLocale(rawLocale: string, config: LocaleConfig): string {
  const locale = rawLocale.trim().toLowerCase();
  if (locale === '') {
    return config.defaultLocale;
  }

  const exactMatch = config.supportedLocales.find((s) => s.trim().toLowerCase() === locale);
  if (exactMatch) {
    return exactMatch;
  }

  const primaryTag = locale.split(/[-_]/)[0];
  const primaryMatch = config.supportedLocales.find(
    (s) => s.trim().toLowerCase().split(/[-_]/)[0] === primaryTag
  );
  if (primaryMatch) {
    return primaryMatch;
  }

  return config.defaultLocale;
}