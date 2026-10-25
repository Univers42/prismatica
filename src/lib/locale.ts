export type Direction = 'ltr' | 'rtl';

export interface LocaleConfig {
  readonly defaultLocale: string;
  readonly supportedLocales: readonly string[];
  readonly rtlLocales?: readonly string[];
}

export const DEFAULT_RTL_LOCALES: readonly string[] = ['ar', 'he', 'fa', 'ur'];

export function isRtlLocale(locale: string, customRtlList?: readonly string[]): boolean {
  const trimmed = locale.trim();
  if (trimmed === '') {
    return false;
  }
  const baseCode = trimmed.split(/[-_]/)[0].toLowerCase();
  const rtlList = customRtlList ?? DEFAULT_RTL_LOCALES;
  return rtlList.includes(baseCode);
}

export function getLocaleDirection(locale: string, customRtlList?: readonly string[]): Direction {
  return isRtlLocale(locale, customRtlList) ? 'rtl' : 'ltr';
}

export function normalizeLocale(rawLocale: string, config: LocaleConfig): string {
  let locale = rawLocale.trim().toLowerCase();
  if (locale === '') {
    return config.defaultLocale;
  }

  if (config.supportedLocales.includes(locale)) {
    return locale;
  }

  const primaryTag = locale.split(/[-_]/)[0];
  if (config.supportedLocales.includes(primaryTag)) {
    return primaryTag;
  }

  return config.defaultLocale;
}