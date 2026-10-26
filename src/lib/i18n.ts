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
    readonly apps: string;
    readonly product: string;
    readonly pricing: string;
  };
  readonly auth: {
    readonly signIn: string;
    readonly startFree: string;
  };
  readonly hero: {
    readonly title: string;
    readonly lede: string;
    readonly startFree: string;
    readonly seeApps: string;
    readonly note: string;
  };
  readonly actions: {
    readonly close: string;
    readonly submit: string;
  };
  readonly greetings: {
    readonly welcomeUser: string;
  };
  readonly finalCta: {
    readonly title: string;
    readonly lede: string;
    readonly startFree: string;
    readonly readDocs: string;
    readonly meta: string;
  };
  readonly socialProof: {
    readonly eyebrow: string;
    readonly title: string;
    readonly quote1: string;
    readonly role1: string;
    readonly quote2: string;
    readonly role2: string;
    readonly quote3: string;
    readonly role3: string;
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
      docs: 'Docs',
      apps: 'Apps',
      product: 'Product',
      pricing: 'Pricing',
    },
    auth: {
      signIn: 'Sign in',
      startFree: 'Start free',
    },
    hero: {
      title: 'All your business apps, connected in one space.',
      lede: 'Pages, databases, boards, calendar, mail and whiteboards that link to each other, so every client, task and date lives in one place.',
      startFree: 'Start free',
      seeApps: 'See every app',
      note: 'No credit card. Self-host whenever you want.',
    },
    actions: {
      close: 'Close',
      submit: 'Submit',
    },
    greetings: {
      welcomeUser: 'Welcome, {name}!',
    },
    finalCta: {
      title: 'Start with one page. Connect the rest as you grow.',
      lede: 'Open source, GDPR-ready, and yours to host.',
      startFree: 'Start free',
      readDocs: 'Read the docs',
      meta: 'No credit card. Self-host whenever you want.',
    },
    socialProof: {
      eyebrow: 'What teams say',
      title: 'Built by people shipping every week.',
      quote1: '“We replaced four SaaS subscriptions with one Compose file. Onboarding now takes a day, not a sprint.”',
      role1: 'Staff Engineer',
      quote2: '“The GDPR plumbing alone saved us six weeks. The mascot is a bonus.”',
      role2: 'Head of Product',
      quote3: '“Self-hosted, audited, owned. Exactly what our security team asked for.”',
      role3: 'CTO',
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
      apps: 'Aplicaciones',
      product: 'Producto',
      pricing: 'Precios',
    },
    auth: {
      signIn: 'Iniciar sesión',
      startFree: 'Empezar gratis',
    },
    hero: {
      title: 'Todas tus aplicaciones de negocio, conectadas en un solo espacio.',
      lede: 'Páginas, bases de datos, tableros, calendario, correo y pizarras vinculadas entre sí, para que cada cliente, tarea y fecha viva en un solo lugar.',
      startFree: 'Empezar gratis',
      seeApps: 'Ver todas las apps',
      note: 'Sin tarjeta de crédito. Autoalojable cuando quieras.',
    },
    actions: {
      close: 'Cerrar',
      submit: 'Enviar',
    },
    greetings: {
      welcomeUser: '¡Bienvenido, {name}!',
    },
    finalCta: {
      title: 'Empieza con una página. Conecta el resto a medida que creces.',
      lede: 'Código abierto, preparado para RGPD y listo para autoalojar.',
      startFree: 'Empezar gratis',
      readDocs: 'Leer la documentación',
      meta: 'Sin tarjeta de crédito. Autoalojable cuando quieras.',
    },
    socialProof: {
      eyebrow: 'Lo que dicen los equipos',
      title: 'Construido por personas que entregan cada semana.',
      quote1: '“Reemplazamos cuatro suscripciones SaaS con un solo archivo Compose. La incorporación ahora lleva un día, no un sprint.”',
      role1: 'Ingeniera Principal',
      quote2: '“La infraestructura de RGPD por sí sola nos ahorró six weeks. La mascota es un extra.”',
      role2: 'Jefe de Producto',
      quote3: '“Autoalojado, auditado y propio. Exactamente lo que pidió nuestro equipo de seguridad.”',
      role3: 'Director de Tecnología',
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
      apps: 'تطبيقات',
      product: 'المنتج',
      pricing: 'الأسعار',
    },
    auth: {
      signIn: 'تسجيل الدخول',
      startFree: 'ابدأ مجاناً',
    },
    hero: {
      title: 'جميع تطبيقات أعمالك، متصلة في مساحة واحدة.',
      lede: 'صفحات وقواعد بيانات ولوحات وتقويم وبريد ولوحات بيضاء مترابطة، بحيث يعيش كل عميل ومهمة وتاريخ في مكان واحد.',
      startFree: 'ابدأ مجاناً',
      seeApps: 'عرض جميع التطبيقات',
      note: 'بدون بطاقة ائتمان. استضفها بنفسك متى شئت.',
    },
    actions: {
      close: 'إغلاق',
      submit: 'إرسال',
    },
    greetings: {
      welcomeUser: 'مرحباً، {name}!',
    },
    finalCta: {
      title: 'ابدأ بصفحة واحدة. واربط الباقي مع نمو أعمالك.',
      lede: 'مفتوح المصدر، متوافق مع GDPR، وجاهز للاستضافة الذاتية.',
      startFree: 'ابدأ مجاناً',
      readDocs: 'اقرأ التوثيق',
meta: 'لا حاجة لبطاقة ائتمان. استضافةذاتية متى شئت.',
    socialProof: {
      eyebrow: 'ما تقوله فرق العمل',
      title: 'صُمم بأيدي أشخاص يطلقون الإنتاج أسبوعياً.',
      quote1: '“استبدلنا أربعة اشتراكات SaaS بملف Compose واحد. أصبح انضمام الفريق يستغرق يوماً واحداً لا مرحلة كاملة.”',
      role1: 'مهندسة رئيسية',
      quote2: '“بنية GDPR التحتية وحدها وفرت علينا ستة أسابيع. والتميمة ميزة إضافية.”',
      role2: 'رئيس المنتجات',
      quote3: '“مستضيف ذاتياً، مُدقَّد، ومملوك بالكامل. exatamente ما طلبه فريق الأمان لدينا.”',
      role3: 'المدير التنفيذي للتكنولوجيا',
    },
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
    return value.replace(/{([a-zA-Z0-9_]+)}/g, (_match: string, paramName: string) => {
      return String(params[paramName] ?? `{${paramName}}`);
    });
  }

  return value;
}