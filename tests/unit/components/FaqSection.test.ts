import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('FaqSection component contract', () => {
  const content = fs.readFileSync(path.resolve(process.cwd(), 'src/components/sections/FaqSection.astro'), 'utf-8');

  it('declares props with locale and imports i18n helpers', () => {
    expect(content).toContain('readonly locale?: string');
    expect(content).toContain("import { t, DEFAULT_LOCALE, SUPPORTED_LOCALES, type SupportedLocale } from '../../lib/i18n'");
  });

  it('binds eyebrow, title, and all 5 Q&A pairs to data-i18n attributes', () => {
    const requiredKeys = [
      'faq.eyebrow',
      'faq.title',
      'faq.q1',
      'faq.a1',
      'faq.q2',
      'faq.a2',
      'faq.q3',
      'faq.a3',
      'faq.q4',
      'faq.a4',
      'faq.q5',
      'faq.a5',
    ];

    for (const key of requiredKeys) {
      expect(content).toContain(key);
    }
  });
});
