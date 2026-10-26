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