import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('FooterNew component contract', () => {
  const content = fs.readFileSync(path.resolve(process.cwd(), 'src/components/sections/FooterNew.astro'), 'utf-8');

  it('declares props with locale and imports i18n helpers', () => {
    expect(content).toContain('readonly locale?: string');
    expect(content).toContain("import { t, DEFAULT_LOCALE, SUPPORTED_LOCALES, type SupportedLocale } from '../../lib/i18n'");
  });

  it('binds footer copy to data-i18n attributes', () => {
    expect(content).toContain('footer.tagline');
    expect(content).toContain('footer.newsletterLabel');
    expect(content).toContain('footer.newsletterButton');
    expect(content).toContain('footer.newsletterConsent');
    expect(content).toContain('footer.newsletterMeta');
    expect(content).toContain('footer.groupProduct');
    expect(content).toContain('footer.linkOverview');
    expect(content).toContain('footer.linkPricing');
    expect(content).toContain('footer.linkFaq');
    expect(content).toContain('footer.groupResources');
    expect(content).toContain('footer.linkDocs');
    expect(content).toContain('footer.groupCompany');
    expect(content).toContain('footer.linkGithub');
    expect(content).toContain('footer.groupLegal');
    expect(content).toContain('footer.linkPrivacy');
    expect(content).toContain('footer.linkTerms');
    expect(content).toContain('footer.linkCookies');
    expect(content).toContain('footer.linkDataRights');
    expect(content).toContain('footer.copyright');
    expect(content).toContain('footer.gdprContact');
  });
});