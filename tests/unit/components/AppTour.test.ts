import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('AppTour component contract', () => {
  const content = fs.readFileSync(path.resolve(process.cwd(), 'src/components/sections/AppTour.astro'), 'utf-8');

  it('declares props with locale and imports i18n helpers', () => {
    expect(content).toContain('readonly locale?: string');
    expect(content).toContain("import { t, DEFAULT_LOCALE, SUPPORTED_LOCALES, type SupportedLocale } from '../../lib/i18n'");
  });

  it('binds app tour copy to data-i18n attributes', () => {
    expect(content).toContain('appTour.title');
    expect(content).toContain('appTour.lede');
    expect(content).toContain('appTour.appDocsName');
    expect(content).toContain('appTour.appDocsHint');
    expect(content).toContain('appTour.appDocsSummary');
    expect(content).toContain('appTour.worksWith');
    expect(content).toContain('appTour.pocketTitle');
    expect(content).toContain('appTour.pocketLede');
  });
});