import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('LogoStrip component contract', () => {
  const content = fs.readFileSync(path.resolve(process.cwd(), 'src/components/sections/LogoStrip.astro'), 'utf-8');

  it('declares props with locale and imports i18n helpers', () => {
    expect(content).toContain('readonly locale?: string');
    expect(content).toContain("import { t, DEFAULT_LOCALE, SUPPORTED_LOCALES, type SupportedLocale } from '../../lib/i18n'");
  });

  it('binds label to data-i18n attribute and localizes aria-label', () => {
    expect(content).toContain('logoStrip.label');
    expect(content).toContain('logoStrip.ariaLabel');
  });
});