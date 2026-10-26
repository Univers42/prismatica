import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('FinalCta component contract', () => {
  const content = fs.readFileSync(path.resolve(process.cwd(), 'src/components/sections/FinalCta.astro'), 'utf-8');

  it('declares props with locale and imports i18n helpers', () => {
    expect(content).toContain('readonly locale?: string');
    expect(content).toContain("import { t, DEFAULT_LOCALE, SUPPORTED_LOCALES, type SupportedLocale } from '../../lib/i18n'");
  });

  it('binds all finalCta text elements to data-i18n attributes', () => {
    for (const key of ['finalCta.title', 'finalCta.lede', 'finalCta.startFree', 'finalCta.readDocs', 'finalCta.meta']) {
      expect(content).toContain(`data-i18n="${key}"`);
      expect(content).toContain(`t(activeLocale, '${key}')`);
    }
  });
});