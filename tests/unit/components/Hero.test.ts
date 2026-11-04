import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const hero = fs.readFileSync(path.resolve(process.cwd(), 'src/components/site/Hero.astro'), 'utf-8');

describe('Hero', () => {
	it('takes the page locale and hands it to the capture', () => {
		expect(hero).toContain('const { locale = DEFAULT_LOCALE } = Astro.props;');
		expect(hero).toMatch(/<CaptureFrame\b[^>]*locale=\{locale\}/);
	});

	it.each(['title', 'lead', 'tour', 'create'])('localizes %s', (key) => {
		expect(hero).toContain(`data-i18n="site.hero.${key}"`);
	});

	// textContent on the link itself would delete the play icon.
	it('keeps the tour label apart from the icon', () => {
		expect(hero).toContain(`<span data-i18n="site.hero.tour">{t(locale, 'site.hero.tour')}</span>`);
	});
});
