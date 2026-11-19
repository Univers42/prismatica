import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('HeaderMobileDrawer component contract', () => {
  const content = fs.readFileSync(path.resolve(process.cwd(), 'src/components/sections/header/HeaderMobileDrawer.astro'), 'utf-8');

  it('declares props contract with navItems and activeLocale', () => {
    expect(content).toContain('readonly navItems: Array<');
    expect(content).toContain('readonly activeLocale: SupportedLocale');
  });

  it('declares mobile drawer container with accessible id and hidden attribute', () => {
    expect(content).toContain('class="header-new__drawer"');
    expect(content).toContain('id="header-new-menu"');
    expect(content).toContain('hidden');
  });

  it('provides a default slot and binds drawer action controls', () => {
    expect(content).toContain('<slot />');
    expect(content).toContain('data-theme-toggle');
    expect(content).toContain('data-open-connect');
    expect(content).toContain('data-open-portal');
  });
});