import { normalizeLocale } from './locale';

/**
 * Supported locale codes for the application.
 */
export type SupportedLocale = 'en' | 'es' | 'ar';

export const SUPPORTED_LOCALES: readonly SupportedLocale[] = ['en', 'es', 'ar'];
export const DEFAULT_LOCALE: SupportedLocale = 'en';

/**
 * UI string definitions used across the application.
 */
export interface UIStrings {
  readonly a11y: {
    readonly skipToContent: string;
    readonly languageSwitcher: string;
    readonly currentLanguage: string;
  };
  readonly nav: {
    readonly home: string;
    readonly docs: string;
  };
  readonly actions: {
    readonly close: string;
    readonly submit: string;
  };
  readonly greetings: {
    readonly welcomeUser: string;
  };
}

export type TranslationDictionary = Record<SupportedLocale, UIStrings>;

export const DICTIONARY: TranslationDictionary = {
  en: {
    a11y: {
      skipToContent: 'Skip to content',
      languageSwitcher: 'Change language',
      currentLanguage: 'Current language',
    },
    nav: {
      home: 'Home',
      docs: 'Documentation',
    },
    actions: {
      close: 'Close',
      submit: 'Submit',
    },
    greetings: {
      welcomeUser: 'Welcome, {name}!',
    },
  },
  es: {
    a11y: {
      skipToContent: 'Saltar al contenido',
      languageSwitcher: 'Cambiar idioma',
      currentLanguage: 'Idioma actual',
    },
    nav: {
      home: 'Inicio',
      docs: 'Documentación',
    },
    actions: {
      close: 'Cerrar',
      submit: 'Enviar',
    },
    greetings: {
      welcomeUser: '¡Bienvenido, {name}!',
    },
  },
  ar: {
    a11y: {
      skipToContent: 'الانتقال إلى المحتوى',
      languageSwitcher: 'تغيير اللغة',
      currentLanguage: 'اللغة الحالية',
    },
    nav: {
      home: 'الرئيسية',
      docs: 'التوثيق',
    },
    actions: {
      close: 'إغلاق',
      submit: 'إرسال',
    },
    greetings: {
      welcomeUser: 'مرحباً، {name}!',
    },
  },
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
    return value.replace(/{([a-zA-Z0-9_]+)}/g, (match: string, paramName: string) => {
      return String(params[paramName] ?? `{${paramName}}`);
    });
  }

  return value;
}