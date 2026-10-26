import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const componentPath = path.resolve(process.cwd(), 'src/components/sections/HeaderNew.astro');
const componentMarkup = fs.readFileSync(componentPath, 'utf-8');

describe('HeaderNew component', () => {
	it('imports LanguageSwitcher from ../ui/LanguageSwitcher.astro', () => {
		expect(componentMarkup).toContain("import LanguageSwitcher from '../ui/LanguageSwitcher.astro'");
	});

	it('declares locale in Props', () => {
		expect(componentMarkup).toContain('type Props = {');
		expect(componentMarkup).toContain('readonly locale?: string');
	});

	it('mounts LanguageSwitcher inside header-new__actions', () => {
		expect(componentMarkup).toContain('header-new__actions');
		expect(componentMarkup).toContain('<LanguageSwitcher currentLocale={locale} />');
	});

	it('mounts LanguageSwitcher inside header-new__drawer-actions', () => {
		expect(componentMarkup).toContain('header-new__drawer-actions');
		expect(componentMarkup).toContain('<LanguageSwitcher currentLocale={locale} isDrawer />');
	});

	it('imports t from ../lib/i18n', () => {
		expect(componentMarkup).toContain("import { t } from '../../lib/i18n'");
	});

	it('navItems labels use t(activeLocale, ...)', () => {
		expect(componentMarkup).toContain("t(activeLocale, 'nav.apps')");
		expect(componentMarkup).toContain("t(activeLocale, 'nav.product')");
		expect(componentMarkup).toContain("t(activeLocale, 'nav.pricing')");
		expect(componentMarkup).toContain("t(activeLocale, 'nav.docs')");
	});

	it('auth buttons use t(activeLocale, ...)', () => {
		expect(componentMarkup).toContain("t(activeLocale, 'auth.signIn')");
		expect(componentMarkup).toContain("t(activeLocale, 'auth.startFree')");
	});
});