import { describe, it, expect } from 'vitest';
import { t } from '../../../src/lib/i18n';

describe('i18n', () => {
  describe('t lookup', () => {
it.each([
      ['en', 'a11y.skipToContent', 'Skip to content'],
      ['es', 'a11y.skipToContent', 'Saltar al contenido'],
      ['ar', 'a11y.skipToContent', 'الانتقال إلى المحتوى'],
      ['ES', 'nav.home', 'Inicio'],
      ['ar-EG', 'actions.close', 'إغلاق'],
      ['en', 'nav.apps', 'Apps'],
      ['es', 'nav.apps', 'Aplicaciones'],
      ['ar', 'nav.apps', 'تطبيقات'],
      ['en', 'nav.product', 'Product'],
      ['es', 'nav.product', 'Producto'],
      ['ar', 'nav.product', 'المنتج'],
      ['en', 'nav.pricing', 'Pricing'],
      ['es', 'nav.pricing', 'Precios'],
      ['ar', 'nav.pricing', 'الأسعار'],
      ['en', 'nav.docs', 'Docs'],
      ['es', 'nav.docs', 'Documentación'],
      ['ar', 'nav.docs', 'التوثيق'],
      ['en', 'auth.signIn', 'Sign in'],
      ['es', 'auth.signIn', 'Iniciar sesión'],
      ['ar', 'auth.signIn', 'تسجيل الدخول'],
      ['en', 'auth.startFree', 'Start free'],
      ['es', 'auth.startFree', 'Empezar gratis'],
      ['ar', 'auth.startFree', 'ابدأ مجاناً'],
      ['en', 'hero.title', 'All your business apps, connected in one space.'],
      ['es', 'hero.title', 'Todas tus aplicaciones de negocio, conectadas en un solo espacio.'],
      ['ar', 'hero.title', 'جميع تطبيقات أعمالك، متصلة في مساحة واحدة.'],
      ['en', 'hero.lede', 'Pages, databases, boards, calendar, mail and whiteboards that link to each other, so every client, task and date lives in one place.'],
      ['es', 'hero.lede', 'Páginas, bases de datos, tableros, calendario, correo y pizarras vinculadas entre sí, para que cada cliente, tarea y fecha viva en un solo lugar.'],
      ['ar', 'hero.lede', 'صفحات وقواعد بيانات ولوحات وتقويم وبريد ولوحات بيضاء مترابطة، بحيث يعيش كل عميل ومهمة وتاريخ في مكان واحد.'],
      ['en', 'hero.startFree', 'Start free'],
      ['es', 'hero.startFree', 'Empezar gratis'],
      ['ar', 'hero.startFree', 'ابدأ مجاناً'],
      ['en', 'hero.seeApps', 'See every app'],
      ['es', 'hero.seeApps', 'Ver todas las apps'],
      ['ar', 'hero.seeApps', 'عرض جميع التطبيقات'],
      ['en', 'hero.note', 'No credit card. Self-host whenever you want.'],
      ['es', 'hero.note', 'Sin tarjeta de crédito. Autoalojable cuando quieras.'],
      ['ar', 'hero.note', 'بدون بطاقة ائتمان. استضفها بنفسك متى شئت.'],
      ['en', 'actions.close', 'Close'],
      ['es', 'actions.close', 'Cerrar'],
      ['ar', 'actions.close', 'إغلاق'],
      ['en', 'actions.submit', 'Submit'],
      ['es', 'actions.submit', 'Enviar'],
      ['ar', 'actions.submit', 'إرسال'],
      ['en', 'finalCta.title', 'Start with one page. Connect the rest as you grow.'],
      ['es', 'finalCta.title', 'Empieza con una página. Conecta el resto a medida que creces.'],
      ['ar', 'finalCta.title', 'ابدأ بصفحة واحدة. واربط الباقي مع نمو أعمالك.'],
      ['en', 'finalCta.lede', 'Open source, GDPR-ready, and yours to host.'],
      ['es', 'finalCta.lede', 'Código abierto, preparado para RGPD y listo para autoalojar.'],
      ['ar', 'finalCta.lede', 'مفتوح المصدر، متوافق مع GDPR، وجاهز للاستضافة الذاتية.'],
      ['en', 'finalCta.startFree', 'Start free'],
      ['es', 'finalCta.startFree', 'Empezar gratis'],
      ['ar', 'finalCta.startFree', 'ابدأ مجاناً'],
      ['en', 'finalCta.readDocs', 'Read the docs'],
      ['es', 'finalCta.readDocs', 'Leer la documentación'],
      ['ar', 'finalCta.readDocs', 'اقرأ التوثيق'],
      ['en', 'finalCta.meta', 'No credit card. Self-host whenever you want.'],
      ['es', 'finalCta.meta', 'Sin tarjeta de crédito. Autoalojable cuando quieras.'],
      ['ar', 'finalCta.meta', 'لا حاجة لبطاقة ائتمان. استضافة ذاتية متى شئت.'],
      ['en', 'featureTrio.eyebrow', 'What you get'],
      ['es', 'featureTrio.eyebrow', 'Lo que obtienes'],
      ['ar', 'featureTrio.eyebrow', 'ما تحصل عليه'],
      ['en', 'featureTrio.title', 'A backend stack you would have built — already built.'],
      ['es', 'featureTrio.title', 'El stack de backend que habrías construido — ya listo.'],
      ['ar', 'featureTrio.title', 'بنية تحتية برمجية كما كنت لتبنيها — مبنية وجاهزة بالفعل.'],
      ['en', 'featureTrio.authTitle', 'Auth that just works'],
      ['es', 'featureTrio.authTitle', 'Autenticación que simplemente funciona'],
      ['ar', 'featureTrio.authTitle', 'نظام مصادقة يعمل بسلاسة'],
      ['en', 'featureTrio.dbTitle', 'PostgREST + Postgres'],
      ['es', 'featureTrio.dbTitle', 'PostgREST + Postgres'],
      ['ar', 'featureTrio.dbTitle', 'PostgREST + Postgres'],
      ['en', 'featureTrio.privacyTitle', 'GDPR by default'],
      ['es', 'featureTrio.privacyTitle', 'RGPD por defecto'],
      ['ar', 'featureTrio.privacyTitle', 'متوافق مع GDPR افتراضياً'],
    ])('resolves locale %s key %s to %s', (locale, key, expected) => {
      expect(t(locale, key as any)).toBe(expected);
    });

    it('interpolates template parameters', () => {
      expect(t('en', 'greetings.welcomeUser', { name: 'Alice' })).toBe('Welcome, Alice!');
      expect(t('es', 'greetings.welcomeUser', { name: 'Carlos' })).toBe('¡Bienvenido, Carlos!');
      expect(t('ar', 'greetings.welcomeUser', { name: 'فاطمة' })).toBe('مرحباً، فاطمة!');
    });

    it('falls back to default locale en when key is missing in requested locale', () => {
      expect(t('es', 'fallback.onlyInEn' as any)).toBe('fallback.onlyInEn');
    });

    it('returns key string if not found in any locale', () => {
      expect(t('en', 'unknown.key' as any)).toBe('unknown.key');
    });
  });
});