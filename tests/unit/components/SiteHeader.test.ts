import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const header = fs.readFileSync(path.resolve(process.cwd(), 'src/components/site/SiteHeader.astro'), 'utf-8');

describe('SiteHeader', () => {
	it('takes the page locale', () => {
		expect(header).toContain('locale?: string;');
		expect(header).toContain('const { locale = DEFAULT_LOCALE } = Astro.props;');
	});

	it('mounts the language switcher once, for desktop and phone alike', () => {
		expect(header.match(/<LanguageSwitcher\b/g)).toHaveLength(1);
		expect(header).toContain('currentLocale={locale}');
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
