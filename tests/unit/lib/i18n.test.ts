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