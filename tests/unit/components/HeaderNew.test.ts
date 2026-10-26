import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('HeaderNew component contract', () => {
  const content = fs.readFileSync(path.resolve(process.cwd(), 'src/components/sections/HeaderNew.astro'), 'utf-8');

  it('declares props and imports switcher & i18n helpers', () => {
    expect(content).toContain("import LanguageSwitcher from '../ui/LanguageSwitcher.astro'");
    expect(content).toContain("import { t, DEFAULT_LOCALE, SUPPORTED_LOCALES, type SupportedLocale } from '../../lib/i18n'");
    expect(content).toContain('type Props = {');
    expect(content).toContain('readonly locale?: string');
  });

  it('mounts LanguageSwitcher in desktop and drawer containers', () => {
    expect(content).toContain('<LanguageSwitcher currentLocale={locale} />');
    expect(content).toContain('<LanguageSwitcher currentLocale={locale} isDrawer />');
  });

  it('binds nav items and auth buttons to dictionary keys', () => {
    for (const key of ['nav.apps', 'nav.product', 'nav.pricing', 'nav.docs', 'auth.signIn', 'auth.startFree']) {
      expect(content).toContain(`'${key}'`);
    }
  });
});