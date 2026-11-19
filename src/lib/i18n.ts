import { normalizeLocale } from './locale';
import type { UIStrings } from '../data/locales/types';
import { en } from '../data/locales/en';
import { es } from '../data/locales/es';
import { ar } from '../data/locales/ar';

/**
 * Supported locale codes for the application.
 */
export type SupportedLocale = 'en' | 'es' | 'ar';

export const SUPPORTED_LOCALES: readonly SupportedLocale[] = ['en', 'es', 'ar'];
export const DEFAULT_LOCALE: SupportedLocale = 'en';

export type { UIStrings };

export type TranslationDictionary = Record<SupportedLocale, UIStrings>;

export const DICTIONARY: TranslationDictionary = {
  en,
  es,
  ar,
};

/**
 * Translates a localized string key for a given locale.
 * Performs case-insensitive locale normalization and falls back to default locale.
 * @param locale - The locale string (e.g. 'en', 'es', 'ar', 'pt-BR')
 * @param key - The dot-separated translation key (e.g. 'a11y.skipToContent')
 * @param params - Optional params for interpolation (e.g. { name: 'Alice' })
 * @returns The translated string value
 */
export function t(
  locale: string,
  key: string,
  params?: Record<string, string | number>
): string {
  const targetLocale = normalizeLocale(locale, {
    defaultLocale: DEFAULT_LOCALE,
    supportedLocales: SUPPORTED_LOCALES,
  });

  const keys = key.split('.');
  let value = DICTIONARY[targetLocale as SupportedLocale] as any;

  for (const k of keys) {
    if (value && typeof value === 'object' && k in value) {
      value = value[k];
    } else {
      value = undefined;
      break;
    }
  }

  if (value === undefined || typeof value !== 'string') {
    value = DICTIONARY[DEFAULT_LOCALE];

    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) {
        value = value[k];
      } else {
        value = undefined;
        break;
      }
    }
  }

  if (value === undefined || typeof value !== 'string') {
    value = key;
  }

  if (params !== undefined) {
    return value.replace(/{([a-zA-Z0-9_]+)}/g, (_match: string, paramName: string) => {
      return String(params[paramName] ?? `{${paramName}}`);
    });
  }

  return value;
}