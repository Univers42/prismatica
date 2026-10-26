import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('FeatureTrio component contract', () => {
  const content = fs.readFileSync(path.resolve(process.cwd(), 'src/components/sections/FeatureTrio.astro'), 'utf-8');

  it('declares props with locale and imports i18n helpers', () => {
    expect(content).toContain('readonly locale?: string');
    expect(content).toContain("import { t, DEFAULT_LOCALE, SUPPORTED_LOCALES, type SupportedLocale } from '../../lib/i18n'");
  });

  it('binds eyebrow, title, lede, and card texts to data-i18n attributes', () => {
    const requiredKeys = [
      'featureTrio.eyebrow',
      'featureTrio.title',
      'featureTrio.lede',
      'featureTrio.authTitle',
      'featureTrio.authLede',
      'featureTrio.dbTitle',
      'featureTrio.dbLede',
      'featureTrio.privacyTitle',
      'featureTrio.privacyLede',
    ];

    for (const key of requiredKeys) {
      expect(content).toContain(key);
    }
  });
});
