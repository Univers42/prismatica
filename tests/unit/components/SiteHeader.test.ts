import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const header = fs.readFileSync(path.resolve(process.cwd(), 'src/components/site/SiteHeader.astro'), 'utf-8');

describe('SiteHeader', () => {
	it('takes the page locale', () => {
		expect(header).toContain('locale?: string;');
		expect(header).toContain('const { locale = DEFAULT_LOCALE } = Astro.props;');
	});

	it('mounts the language switcher in the bar and in the phone menu', () => {
		expect(header).toContain('<LanguageSwitcher class="button button--icon site-header__language" currentLocale={locale} />');
		expect(header).toContain('<LanguageSwitcher class="site-menu__language" currentLocale={locale} isDrawer />');
	});

	it('hands the bar over to the menu below the same width the nav folds at', () => {
		expect(header).toMatch(/\.site-header__actions :global\(\.site-header__language\) \{\s*display: none;/);
		expect(header).toMatch(/@media \(min-width: 48rem\)[\s\S]*\.site-header__language\) \{\s*display: inline-grid;/);
	});

	// "Iniciar sesión" and the Arabic label are wider than the English this bar was drawn for.
	it('keeps sign-in on one line', () => {
		expect(header).toMatch(/\.site-header__signin \{[^}]*white-space: nowrap;/);
	});

	it('binds both navs and the actions to dictionary keys', () => {
		expect(header.match(/data-i18n=\{item\.key\}/g)).toHaveLength(2);
		expect(header).toContain('data-i18n="auth.signIn"');
		expect(header.match(/data-i18n="site\.nav\.createWorkspace"/g)).toHaveLength(2);
	});

	it('keeps sign-in and create behind JavaScript', () => {
		expect(header).toMatch(/data-open-connect data-js-only/);
		expect(header).toMatch(/site-header__create"[^>]*data-open-portal data-js-only/);
	});
});
