import { describe, it, expect } from 'vitest';
import { t } from '../../../src/lib/i18n';

describe('i18n', () => {
  describe('t lookup', () => {
    it('t en a11y.skipToContent returns Skip to content', () => {
      expect(t('en', 'a11y.skipToContent')).toBe('Skip to content');
    });

    it('t es a11y.skipToContent returns Saltar al contenido', () => {
      expect(t('es', 'a11y.skipToContent')).toBe('Saltar al contenido');
    });

    it('t ar a11y.skipToContent returns الوانتقال إلى المحتوى', () => {
      expect(t('ar', 'a11y.skipToContent')).toBe('الانتقال إلى المحتوى');
    });

    it('t ES nav.home returns Inicio (case-insensitive locale)', () => {
      expect(t('ES', 'nav.home')).toBe('Inicio');
    });

    it('t ar-EG actions.close returns إغلاق (regional locale)', () => {
      expect(t('ar-EG', 'actions.close')).toBe('إغلاق');
    });

    describe('nav', () => {
      it.each([
        ['en', 'nav.apps', 'Apps'],
        ['es', 'nav.apps', 'Aplicaciones'],
        ['ar', 'nav.apps', 'تطبيقات'],
      ])('t %p nav.apps returns %s', (locale, _, expected) => {
        expect(t(locale, 'nav.apps')).toBe(expected);
      });

      it.each([
        ['en', 'nav.product', 'Product'],
        ['es', 'nav.product', 'Producto'],
        ['ar', 'nav.product', 'المنتج'],
      ])('t %p nav.product returns %s', (locale, _, expected) => {
        expect(t(locale, 'nav.product')).toBe(expected);
      });

      it.each([
        ['en', 'nav.pricing', 'Pricing'],
        ['es', 'nav.pricing', 'Precios'],
        ['ar', 'nav.pricing', 'الأسعار'],
      ])('t %p nav.pricing returns %s', (locale, _, expected) => {
        expect(t(locale, 'nav.pricing')).toBe(expected);
      });

      it.each([
        ['en', 'nav.docs', 'Docs'],
        ['es', 'nav.docs', 'Documentación'],
        ['ar', 'nav.docs', 'التوثيق'],
      ])('t %p nav.docs returns %s', (locale, _, expected) => {
        expect(t(locale, 'nav.docs')).toBe(expected);
      });
    });

    describe('auth', () => {
      it.each([
        ['en', 'auth.signIn', 'Sign in'],
        ['es', 'auth.signIn', 'Iniciar sesión'],
        ['ar', 'auth.signIn', 'تسجيل الدخول'],
      ])('t %p auth.signIn returns %s', (locale, _, expected) => {
        expect(t(locale, 'auth.signIn')).toBe(expected);
      });

      it.each([
        ['en', 'auth.startFree', 'Start free'],
        ['es', 'auth.startFree', 'Empezar gratis'],
        ['ar', 'auth.startFree', 'ابدأ مجاناً'],
      ])('t %p auth.startFree returns %s', (locale, _, expected) => {
        expect(t(locale, 'auth.startFree')).toBe(expected);
      });
    });

    describe('hero', () => {
      it.each([
        ['en', 'hero.title', 'All your business apps, connected in one space.'],
        ['es', 'hero.title', 'Todas tus aplicaciones de negocio, conectadas en un solo espacio.'],
        ['ar', 'hero.title', 'جميع تطبيقات أعمالك، متصلة في مساحة واحدة.'],
      ])('t %p hero.title returns %s', (locale, _, expected) => {
        expect(t(locale, 'hero.title')).toBe(expected);
      });

      it.each([
        ['en', 'hero.startFree', 'Start free'],
        ['es', 'hero.startFree', 'Empezar gratis'],
        ['ar', 'hero.startFree', 'ابدأ مجاناً'],
      ])('t %p hero.startFree returns %s', (locale, _, expected) => {
        expect(t(locale, 'hero.startFree')).toBe(expected);
      });

      it.each([
        ['en', 'hero.seeApps', 'See every app'],
        ['es', 'hero.seeApps', 'Ver todas las apps'],
        ['ar', 'hero.seeApps', 'عرض جميع التطبيقات'],
      ])('t %p hero.seeApps returns %s', (locale, _, expected) => {
        expect(t(locale, 'hero.seeApps')).toBe(expected);
      });
    });

    describe('t fallback', () => {
      it('t fr a11y.skipToContent falls back to Skip to content (unsupported locale)', () => {
        expect(t('fr', 'a11y.skipToContent')).toBe('Skip to content');
      });

      it('t es nonexistent.key returns nonexistent.key (missing key)', () => {
        expect(t('es', 'nonexistent.key')).toBe('nonexistent.key');
      });
    });

    describe('t interpolation', () => {
      it('t en greetings.welcomeUser with name Alex returns Welcome, Alex!', () => {
        expect(t('en', 'greetings.welcomeUser', { name: 'Alex' })).toBe('Welcome, Alex!');
      });

      it('t es greetings.welcomeUser with name Carlos returns ¡Bienvenido, Carlos!', () => {
        expect(t('es', 'greetings.welcomeUser', { name: 'Carlos' })).toBe('¡Bienvenido, Carlos!');
      });

      it('t ar greetings.welcomeUser with name سارة returns مرحبا، سارة!', () => {
        expect(t('ar', 'greetings.welcomeUser', { name: 'سارة' })).toBe('مرحباً، سارة!');
      });

      it('t en greetings.welcomeUser with empty params returns Welcome, {name}!', () => {
        expect(t('en', 'greetings.welcomeUser', {})).toBe('Welcome, {name}!');
      });
    });
  });
});