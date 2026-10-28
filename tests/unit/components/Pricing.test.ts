import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('Pricing component contract', () => {
  const content = fs.readFileSync(path.resolve(process.cwd(), 'src/components/sections/Pricing.astro'), 'utf-8');

  it('declares props with locale and imports i18n helpers', () => {
    expect(content).toContain('readonly locale?: string');
    expect(content).toContain("import { t, DEFAULT_LOCALE, SUPPORTED_LOCALES, type SupportedLocale } from '../../lib/i18n'");
  });

  it('binds eyebrow, title, lede, and tiers to data-i18n attributes', () => {
    const requiredKeys = [
      'pricing.eyebrow',
      'pricing.title',
      'pricing.lede',
      'pricing.freeName',
      'pricing.teamName',
      'pricing.selfName',
      'pricing.mostPopular',
    ];

    for (const key of requiredKeys) {
      expect(content).toContain(key);
    }
  });
});