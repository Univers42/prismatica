import { describe, it, expect } from 'vitest';
import { isRtlLocale, getLocaleDirection, normalizeLocale, DEFAULT_RTL_LOCALES } from '../../../src/lib/locale';
import type { Direction } from '../../../src/lib/locale';

describe('isRtlLocale', () => {
  it('returns true for Arabic', () => {
    expect(isRtlLocale('ar')).toBe(true);
  });

  it('returns true for Hebrew', () => {
    expect(isRtlLocale('he')).toBe(true);
  });

  it('returns true for case-insensitive AR-EG', () => {
    expect(isRtlLocale('AR-EG')).toBe(true);
  });

  it('returns true for underscore delimiter he_IL', () => {
    expect(isRtlLocale('he_IL')).toBe(true);
  });

  it('returns false for English', () => {
    expect(isRtlLocale('en')).toBe(false);
  });

  it('returns false for Spanish', () => {
    expect(isRtlLocale('es')).toBe(false);
  });

  it('returns false for empty string', () => {
    expect(isRtlLocale('')).toBe(false);
  });

  it('returns false for whitespace only', () => {
    expect(isRtlLocale('   ')).toBe(false);
  });

  it('returns true with custom RTL list syr', () => {
    expect(isRtlLocale('syr', ['syr'])).toBe(true);
  });
});

describe('getLocaleDirection', () => {
  it('returns rtl for Arabic', () => {
    expect(getLocaleDirection('ar')).toBe('rtl');
  });

  it('returns ltr for English', () => {
    expect(getLocaleDirection('en')).toBe('ltr');
  });

  it('returns ltr for unknown locale', () => {
    expect(getLocaleDirection('unknown')).toBe('ltr');
  });
});

describe('normalizeLocale', () => {
  const config = {
    defaultLocale: 'en',
    supportedLocales: ['en', 'es', 'ar'] as readonly string[],
  };

  it('returns exact match es', () => {
    expect(normalizeLocale('es', config)).toBe('es');
  });

  it('returns exact match ES (case-insensitive)', () => {
    expect(normalizeLocale('ES', config)).toBe('es');
  });

  it('returns primary tag es-MX', () => {
    expect(normalizeLocale('es-MX', config)).toBe('es');
  });

  it('returns primary tag ar-SA', () => {
    expect(normalizeLocale('ar-SA', config)).toBe('ar');
  });

  it('falls back to default fr', () => {
    const config2 = {
      defaultLocale: 'en',
      supportedLocales: ['en', 'es', 'ar'] as readonly string[],
    };
    expect(normalizeLocale('fr', config2)).toBe('en');
  });

  it('falls back to default on empty string', () => {
    expect(normalizeLocale('', config)).toBe('en');
  });
});