import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('SocialProof component contract', () => {
  const content = fs.readFileSync(path.resolve(process.cwd(), 'src/components/sections/SocialProof.astro'), 'utf-8');

  it('declares props with locale and imports i18n helpers', () => {
    expect(content).toContain('readonly locale?: string');
    expect(content).toContain("import { t, DEFAULT_LOCALE, SUPPORTED_LOCALES, type SupportedLocale } from '../../lib/i18n'");
  });

  it('binds eyebrow, title, quotes, and roles to data-i18n attributes', () => {
    for (const key of ['socialProof.eyebrow', 'socialProof.title', 'socialProof.quote1', 'socialProof.role1']) {
      expect(content).toContain(key);
    }
  });
});