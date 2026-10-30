import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('CanvasWindowsSection component contract', () => {
  const content = fs.readFileSync(path.resolve(process.cwd(), 'src/components/sections/CanvasWindowsSection.astro'), 'utf-8');
  const galleryContent = fs.readFileSync(path.resolve(process.cwd(), 'src/components/sections/ScreenGallery.astro'), 'utf-8');

  it('declares props with locale and imports i18n helpers', () => {
    expect(content).toContain('readonly locale?: string');
    expect(content).toContain("import { t, DEFAULT_LOCALE, SUPPORTED_LOCALES, type SupportedLocale } from '../../lib/i18n'");
    expect(galleryContent).toContain('readonly locale?: string');
  });

  it('binds canvas and screen gallery copy to data-i18n attributes', () => {
    expect(content).toContain('canvasWindows.eyebrow');
    expect(content).toContain('canvasWindows.title');
    expect(content).toContain('canvasWindows.lede');
    expect(galleryContent).toContain('screenGallery.title');
    expect(galleryContent).toContain('screenGallery.crmDealsTitle');
  });
});