import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('DocsTeaser component contract', () => {
  const content = fs.readFileSync(path.resolve(process.cwd(), 'src/components/sections/DocsTeaser.astro'), 'utf-8');

  it('declares props with locale and imports i18n helpers', () => {
    expect(content).toContain('readonly locale?: string');
    expect(content).toContain("import { t, DEFAULT_LOCALE, SUPPORTED_LOCALES, type SupportedLocale } from '../../lib/i18n'");
  });

  it('binds eyebrow, title, lede, button, and all 4 links to data-i18n attributes', () => {
    const requiredKeys = [
      'docsTeaser.eyebrow',
      'docsTeaser.title',
      'docsTeaser.lede',
      'docsTeaser.openDocs',
      'docsTeaser.copy',
      'docsTeaser.linkQuickstart',
      'docsTeaser.linkAuth',
      'docsTeaser.linkPostgrest',
      'docsTeaser.linkGdpr',
    ];

    for (const key of requiredKeys) {
      expect(content).toContain(key);
    }
  });
});